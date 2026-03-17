/**
 * Community Routes - Forum & Social Features (like Wefunder)
 * 
 * Uses Prisma ORM for database persistence
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma, prismaReplica } from '../database';
import { shouldUseDatabase } from '../migration-manager';

const router = Router();

function requireTenantId(req: AuthenticatedRequest, res: Response): string | undefined {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
        res.status(403).json({ error: 'Tenant context required' });
        return undefined;
    }
    return tenantId;
}

// Get all posts
router.get('/posts', authorize('community.post_list'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.json({ posts: [], total: 0, page: 1, limit: 20, totalPages: 0 });
            return;
        }

        const { category, isPinned, authorId, search, page = '1', limit = '20' } = req.query;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = { status: 'PUBLISHED', tenantId };

        if (category) where.category = category;
        if (isPinned === 'true') where.isPinned = true;
        if (authorId) where.authorId = authorId;
        if (search) {
            where.OR = [
                { title: { contains: search as string, mode: 'insensitive' } },
                { content: { contains: search as string, mode: 'insensitive' } }
            ];
        }

        const [posts, total] = await Promise.all([
            prismaReplica.communityPost.findMany({
                where,
                orderBy: [
                    { isPinned: 'desc' },
                    { createdAt: 'desc' }
                ],
                skip,
                take: limitNum,
                include: {
                    _count: {
                        select: { comments: true }
                    }
                }
            }),
            prismaReplica.communityPost.count({ where })
        ]);

        // Fetch author info for each post
        const authorIds = [...new Set(posts.map(p => p.authorId))] as string[];
        const authors = await prismaReplica.user.findMany({
            where: { id: { in: authorIds }, tenantId },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true
            }
        });
        const authorMap = new Map(authors.map(a => [a.id, {
            id: a.id,
            name: `${a.firstName} ${a.lastName}`,
            role: a.role,
            avatar: null
        }]));

        // Transform for frontend
        const result = posts.map((p: any) => ({
            ...p,
            commentCount: p._count.comments,
            author: authorMap.get(p.authorId) || {
                id: p.authorId,
                name: 'Unknown User',
                role: 'USER',
                avatar: null
            },
            isAnnouncement: p.category === 'ANNOUNCEMENT'
        }));

        res.json({
            posts: result,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum)
        });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
});

// Get post by ID
router.get('/posts/:id', authorize('community.post_read'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.status(404).json({ error: 'Post not found' });
            return;
        }

        // Read from replica
        const post = await prismaReplica.communityPost.findFirst({
            where: { id: req.params.id, tenantId },
            include: {
                comments: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        replies: {
                            orderBy: { createdAt: 'asc' }
                        }
                    }
                }
            }
        });

        if (!post) {
            res.status(404).json({ error: 'Post not found' });
            return;
        }

        // Increment view count on primary (fire and forget mostly, or await)
        await prisma.communityPost.update({
            where: { id: post.id },
            data: { views: { increment: 1 } }
        });

        res.json({ ...post, views: post.views + 1 });
    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).json({ error: 'Failed to fetch post' });
    }
});

// Create post
router.post('/posts', authorize('community.post_create'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        const { title, content, category, smeId, dealId, syndicateId } = req.body;

        if (!title || !content) {
            res.status(400).json({ error: 'Title and content are required' });
            return;
        }

        const post = await prisma.communityPost.create({
            data: {
                tenantId,
                authorId: req.user?.id || 'anonymous',
                title,
                content,
                category: category || 'GENERAL',
                smeId,
                dealId,
                syndicateId,
                status: 'PUBLISHED'
            }
        });

        res.status(201).json(post);
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ error: 'Failed to create post' });
    }
});

// Update post
router.put('/posts/:id', authorize('community.post_update'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        const existing = await prisma.communityPost.findFirst({
            where: { id: req.params.id, tenantId }
        });

        if (!existing) {
            res.status(404).json({ error: 'Post not found' });
            return;
        }

        // Check ownership or admin
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const isOwner = existing.authorId === userId;
        const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

        if (!isOwner && !isAdmin) {
            res.status(403).json({ error: 'Not authorized to edit this post' });
            return;
        }

        const { title, content, category, isPinned, status } = req.body;

        const updateData: any = {};
        if (title) updateData.title = title;
        if (content) updateData.content = content;
        if (category) updateData.category = category;
        if (isAdmin && isPinned !== undefined) updateData.isPinned = isPinned;
        if (status) updateData.status = status;

        const post = await prisma.communityPost.update({
            where: { id: req.params.id },
            data: updateData
        });

        res.json(post);
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).json({ error: 'Failed to update post' });
    }
});

// Delete post
router.delete('/posts/:id', authorize('community.post_delete'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        const existing = await prisma.communityPost.findFirst({
            where: { id: req.params.id, tenantId }
        });

        if (!existing) {
            res.status(404).json({ error: 'Post not found' });
            return;
        }

        // Check ownership or admin
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const isOwner = existing.authorId === userId;
        const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

        if (!isOwner && !isAdmin) {
            res.status(403).json({ error: 'Not authorized to delete this post' });
            return;
        }

        await prisma.communityPost.delete({
            where: { id: req.params.id }
        });

        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ error: 'Failed to delete post' });
    }
});

// Like post
router.post('/posts/:id/like', authorize('community.post_read'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        const post = await prisma.communityPost.findFirst({
            where: { id: req.params.id, tenantId },
            select: { id: true }
        });
        if (!post) {
            res.status(404).json({ error: 'Post not found' });
            return;
        }

        const updatedPost = await prisma.communityPost.update({
            where: { id: post.id },
            data: { likes: { increment: 1 } }
        });

        res.json({ likes: updatedPost.likes });
    } catch (error) {
        console.error('Error liking post:', error);
        res.status(500).json({ error: 'Failed to like post' });
    }
});

// Add comment
router.post('/posts/:id/comments', authorize('community.comment_create'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        const { content, parentId } = req.body;

        if (!content) {
            res.status(400).json({ error: 'Content is required' });
            return;
        }

        // Verify post exists
        const post = await prisma.communityPost.findFirst({
            where: { id: req.params.id, tenantId }
        });

        if (!post) {
            res.status(404).json({ error: 'Post not found' });
            return;
        }

        const comment = await prisma.comment.create({
            data: {
                postId: req.params.id,
                authorId: req.user?.id || 'anonymous',
                content,
                parentId
            }
        });

        res.status(201).json(comment);
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// Like comment
router.post('/comments/:id/like', authorize('community.post_read'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        const existingComment = await prisma.comment.findFirst({
            where: { id: req.params.id, post: { tenantId } },
            select: { id: true }
        });
        if (!existingComment) {
            res.status(404).json({ error: 'Comment not found' });
            return;
        }

        const comment = await prisma.comment.update({
            where: { id: existingComment.id },
            data: { likes: { increment: 1 } }
        });

        res.json({ likes: comment.likes });
    } catch (error) {
        console.error('Error liking comment:', error);
        res.status(500).json({ error: 'Failed to like comment' });
    }
});

// Get community stats
router.get('/stats', authorize('community.post_list'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.json({
                totalPosts: 0,
                totalComments: 0,
                totalLikes: 0,
                activeUsers: 0,
                topCategories: []
            });
            return;
        }

        const [totalPosts, totalComments, likesResult] = await Promise.all([
            prismaReplica.communityPost.count({ where: { status: 'PUBLISHED', tenantId } }),
            prismaReplica.comment.count({ where: { post: { tenantId } } }),
            prismaReplica.communityPost.aggregate({
                where: { status: 'PUBLISHED', tenantId },
                _sum: { likes: true }
            })
        ]);

        // Get category distribution
        const categories = await prismaReplica.communityPost.groupBy({
            by: ['category'],
            where: { status: 'PUBLISHED', tenantId },
            _count: { category: true },
            orderBy: { _count: { category: 'desc' } },
            take: 5
        });

        res.json({
            totalPosts,
            totalComments,
            totalLikes: likesResult._sum.likes || 0,
            activeUsers: 0, // Would need to track unique authors
            topCategories: categories.map(c => ({
                category: c.category,
                count: c._count.category
            }))
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Get categories
router.get('/categories', authorize('community.post_list'), async (req: AuthenticatedRequest, res: Response) => {
    res.json({
        categories: [
            { id: 'GENERAL', name: 'General Discussion', description: 'General topics and discussions' },
            { id: 'ANNOUNCEMENT', name: 'Announcements', description: 'Official platform announcements' },
            { id: 'INVESTOR_INSIGHT', name: 'Investor Insights', description: 'Investment strategies and insights' },
            { id: 'SME_NEWS', name: 'SME News', description: 'Company updates and news' },
            { id: 'QUESTION', name: 'Questions', description: 'Ask the community' },
            { id: 'SUCCESS_STORY', name: 'Success Stories', description: 'Celebrate achievements' }
        ]
    });
});

export default router;
