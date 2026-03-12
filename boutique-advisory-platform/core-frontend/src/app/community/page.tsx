'use client'

import { useState, useEffect } from 'react'
import {
    MessageSquare,
    Plus,
    ThumbsUp,
    MessageCircle,
    Eye,
    Pin,
    Megaphone,
    HelpCircle,
    Trophy,
    TrendingUp,
    Users,
    Send,
    X,
    Clock,
    Bookmark,
    Share2,
    Star
} from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useToast } from '../../contexts/ToastContext'
import { authorizedRequest } from '@/lib/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003'

interface Author {
    id: string
    name: string
    role: string
    avatar: string | null
}

interface Post {
    id: string
    authorId: string
    author: Author
    title: string
    content: string
    category: string
    smeId?: string
    dealId?: string
    syndicateId?: string
    likes: number
    views: number
    isPinned: boolean
    isAnnouncement: boolean
    commentCount: number
    createdAt: string
    updatedAt: string
}

interface Comment {
    id: string
    postId: string
    authorId: string
    author: Author
    content: string
    parentId: string | null
    likes: number
    createdAt: string
    replies?: Comment[]
}

interface CommunityStats {
    totalPosts: number
    totalComments: number
    totalViews: number
    totalLikes: number
    categoryDistribution: Record<string, number>
    trendingPosts: Post[]
}

const categoryIcons: Record<string, any> = {
    GENERAL: MessageSquare,
    ANNOUNCEMENT: Megaphone,
    INVESTOR_INSIGHT: TrendingUp,
    SME_NEWS: Star,
    QUESTION: HelpCircle,
    SUCCESS_STORY: Trophy
}

const categoryColors: Record<string, string> = {
    GENERAL: 'bg-gray-500/20 text-gray-400',
    ANNOUNCEMENT: 'bg-purple-500/20 text-purple-400',
    INVESTOR_INSIGHT: 'bg-blue-500/20 text-blue-400',
    SME_NEWS: 'bg-green-500/20 text-green-400',
    QUESTION: 'bg-amber-500/20 text-amber-400',
    SUCCESS_STORY: 'bg-pink-500/20 text-pink-400'
}

const roleColors: Record<string, string> = {
    ADMIN: 'text-purple-400',
    ADVISOR: 'text-blue-400',
    INVESTOR: 'text-green-400',
    SME: 'text-amber-400',
    SUPPORT: 'text-gray-400'
}

export default function CommunityPage() {
    const { addToast } = useToast()

    const [posts, setPosts] = useState<Post[]>([])
    const [stats, setStats] = useState<CommunityStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [selectedPost, setSelectedPost] = useState<Post | null>(null)
    const [comments, setComments] = useState<Comment[]>([])
    const [activeCategory, setActiveCategory] = useState<string>('all')
    const [showNewPostModal, setShowNewPostModal] = useState(false)
    const [newComment, setNewComment] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // New post form
    const [newPostTitle, setNewPostTitle] = useState('')
    const [newPostContent, setNewPostContent] = useState('')
    const [newPostCategory, setNewPostCategory] = useState('GENERAL')

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const userData = localStorage.getItem('user')
            if (!userData) {
                window.location.href = '/auth/login'
                return
            }

            // Fetch posts
            const postsRes = await authorizedRequest('/api/community/posts')
            if (postsRes.ok) {
                const data = await postsRes.json()
                setPosts(data.posts || data)
            }

            // Fetch stats
            const statsRes = await authorizedRequest('/api/community/stats')
            if (statsRes.ok) {
                setStats(await statsRes.json())
            }
        } catch (error) {
            console.error('Error fetching data:', error)
            addToast('error', 'Error loading community posts')
        } finally {
            setIsLoading(false)
        }
    }

    const fetchPostDetails = async (post: Post) => {
        try {
            const res = await authorizedRequest(`/api/community/posts/${post.id}`)
            if (res.ok) {
                const data = await res.json()
                setSelectedPost(data)
                setComments(data.comments || [])
            }
        } catch (error) {
            console.error('Error fetching post details:', error)
        }
    }

    const handleLikePost = async (postId: string) => {
        try {
            const res = await authorizedRequest(`/api/community/posts/${postId}/like`, {
                method: 'POST'
            })
            if (res.ok) {
                setPosts(posts.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p))
                if (selectedPost?.id === postId) {
                    setSelectedPost({ ...selectedPost, likes: selectedPost.likes + 1 })
                }
            }
        } catch (error) {
            console.error('Error liking post:', error)
        }
    }

    const handleCreatePost = async () => {
        if (!newPostTitle.trim() || !newPostContent.trim()) {
            addToast('error', 'Please fill in title and content')
            return
        }

        setIsSubmitting(true)
        try {
            const res = await authorizedRequest('/api/community/posts', {
                method: 'POST',
                body: JSON.stringify({
                    title: newPostTitle,
                    content: newPostContent,
                    category: newPostCategory
                })
            })

            if (res.ok) {
                addToast('success', 'Post created successfully!')
                setShowNewPostModal(false)
                setNewPostTitle('')
                setNewPostContent('')
                setNewPostCategory('GENERAL')
                fetchData()
            } else {
                addToast('error', 'Failed to create post')
            }
        } catch (error) {
            console.error('Error creating post:', error)
            addToast('error', 'Error creating post')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleAddComment = async () => {
        if (!newComment.trim() || !selectedPost) return

        setIsSubmitting(true)
        try {
            const res = await authorizedRequest(`/api/community/posts/${selectedPost.id}/comments`, {
                method: 'POST',
                body: JSON.stringify({ content: newComment })
            })

            if (res.ok) {
                const newCommentData = await res.json()
                setComments([...comments, newCommentData])
                setNewComment('')
                setSelectedPost({ ...selectedPost, commentCount: selectedPost.commentCount + 1 })
            }
        } catch (error) {
            console.error('Error adding comment:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

        if (diffDays === 0) return 'Today'
        if (diffDays === 1) return 'Yesterday'
        if (diffDays < 7) return `${diffDays} days ago`
        return date.toLocaleDateString()
    }

    const filteredPosts = activeCategory === 'all'
        ? posts
        : posts.filter(p => p.category === activeCategory)

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-full min-h-[400px]">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="flex gap-6">
                {/* Main Content */}
                <div className="flex-1">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                <Users className="w-8 h-8 text-blue-400" />
                                Community
                            </h1>
                            <p className="text-gray-400 mt-1">Connect with investors, SMEs, and advisors</p>
                        </div>
                        <button
                            onClick={() => setShowNewPostModal(true)}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-5 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg"
                        >
                            <Plus className="w-5 h-5" />
                            New Post
                        </button>
                    </div>

                    {/* Category Tabs */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        <button
                            onClick={() => setActiveCategory('all')}
                            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${activeCategory === 'all'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                        >
                            All Posts
                        </button>
                        {Object.entries(categoryIcons).map(([category, Icon]) => (
                            <button
                                key={category}
                                onClick={() => setActiveCategory(category)}
                                className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${activeCategory === category
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                {category.replace('_', ' ')}
                            </button>
                        ))}
                    </div>

                    {/* Posts Feed */}
                    <div className="space-y-4">
                        {filteredPosts.map((post) => (
                            <div
                                key={post.id}
                                onClick={() => fetchPostDetails(post)}
                                className={`bg-gray-800 rounded-xl p-5 border cursor-pointer transition-all hover:border-blue-500/50 ${post.isPinned ? 'border-purple-500/50' : 'border-gray-700'
                                    }`}
                            >
                                {/* Post Header */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                                            <span className="text-white font-semibold">
                                                {(post.author?.name || 'U').charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-white font-medium">{post.author?.name || 'Unknown'}</span>
                                                <span className={`text-xs ${roleColors[post.author?.role || ''] || 'text-gray-400'}`}>
                                                    {post.author?.role || 'Member'}
                                                </span>
                                            </div>
                                            <span className="text-xs text-gray-500">{formatDate(post.createdAt)}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {post.isPinned && (
                                            <Pin className="w-4 h-4 text-purple-400" />
                                        )}
                                        {post.isAnnouncement && (
                                            <Megaphone className="w-4 h-4 text-amber-400" />
                                        )}
                                        <span className={`px-2 py-1 rounded-full text-xs ${categoryColors[post.category]}`}>
                                            {post.category.replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>

                                {/* Post Content */}
                                <h3 className="text-lg font-semibold text-white mb-2">{post.title}</h3>
                                <p className="text-gray-400 text-sm line-clamp-3 mb-4">{post.content}</p>

                                {/* Post Stats */}
                                <div className="flex items-center gap-6 text-sm text-gray-500">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleLikePost(post.id); }}
                                        className="flex items-center gap-1 hover:text-blue-400 transition-colors"
                                    >
                                        <ThumbsUp className="w-4 h-4" />
                                        {post.likes}
                                    </button>
                                    <span className="flex items-center gap-1">
                                        <MessageCircle className="w-4 h-4" />
                                        {post.commentCount}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Eye className="w-4 h-4" />
                                        {post.views}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {filteredPosts.length === 0 && (
                        <div className="text-center py-16">
                            <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400 text-lg">No posts in this category yet</p>
                            <p className="text-gray-500 text-sm mt-2">Be the first to start a discussion!</p>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="w-80 space-y-6 hidden lg:block">
                    {/* Stats Card */}
                    {stats && (
                        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                            <h3 className="text-lg font-semibold text-white mb-4">Community Stats</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="text-center p-3 bg-gray-700/50 rounded-lg">
                                    <p className="text-2xl font-bold text-white">{stats.totalPosts}</p>
                                    <p className="text-xs text-gray-400">Posts</p>
                                </div>
                                <div className="text-center p-3 bg-gray-700/50 rounded-lg">
                                    <p className="text-2xl font-bold text-white">{stats.totalComments}</p>
                                    <p className="text-xs text-gray-400">Comments</p>
                                </div>
                                <div className="text-center p-3 bg-gray-700/50 rounded-lg">
                                    <p className="text-2xl font-bold text-white">{stats.totalViews}</p>
                                    <p className="text-xs text-gray-400">Views</p>
                                </div>
                                <div className="text-center p-3 bg-gray-700/50 rounded-lg">
                                    <p className="text-2xl font-bold text-white">{stats.totalLikes}</p>
                                    <p className="text-xs text-gray-400">Likes</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Trending Posts */}
                    {stats?.trendingPosts && stats.trendingPosts.length > 0 && (
                        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-amber-400" />
                                Trending
                            </h3>
                            <div className="space-y-3">
                                {stats.trendingPosts.slice(0, 5).map((post, i) => (
                                    <div
                                        key={post.id}
                                        className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-700/50 cursor-pointer transition-colors"
                                        onClick={() => fetchPostDetails(post)}
                                    >
                                        <span className="text-lg font-bold text-gray-500">{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-white truncate">{post.title}</p>
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <span>{post.views} views</span>
                                                <span>•</span>
                                                <span>{post.likes} likes</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Post Detail Modal */}
            {selectedPost && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-gray-700 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                                    <span className="text-white font-semibold">
                                        {(selectedPost.author?.name || 'U').charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-white font-medium">{selectedPost.author?.name || 'Unknown'}</span>
                                    <span className={`ml-2 text-xs ${roleColors[selectedPost.author?.role || ''] || 'text-gray-400'}`}>
                                        {selectedPost.author?.role || 'Member'}
                                    </span>
                                    <p className="text-xs text-gray-500">{formatDate(selectedPost.createdAt)}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedPost(null)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Post Content */}
                        <div className="p-5 overflow-y-auto flex-1">
                            <span className={`px-3 py-1 rounded-full text-xs inline-block mb-3 ${categoryColors[selectedPost.category]}`}>
                                {selectedPost.category.replace('_', ' ')}
                            </span>
                            <h2 className="text-2xl font-bold text-white mb-4">{selectedPost.title}</h2>
                            <div className="prose prose-invert max-w-none">
                                <p className="text-gray-300 whitespace-pre-wrap">{selectedPost.content}</p>
                            </div>

                            {/* Post Actions */}
                            <div className="flex items-center gap-4 mt-6 pt-4 border-t border-gray-700">
                                <button
                                    onClick={() => handleLikePost(selectedPost.id)}
                                    className="flex items-center gap-2 text-gray-400 hover:text-blue-400 transition-colors"
                                >
                                    <ThumbsUp className="w-5 h-5" />
                                    <span>{selectedPost.likes}</span>
                                </button>
                                <span className="flex items-center gap-2 text-gray-400">
                                    <Eye className="w-5 h-5" />
                                    <span>{selectedPost.views}</span>
                                </span>
                                <button className="flex items-center gap-2 text-gray-400 hover:text-amber-400 transition-colors ml-auto">
                                    <Bookmark className="w-5 h-5" />
                                </button>
                                <button className="flex items-center gap-2 text-gray-400 hover:text-green-400 transition-colors">
                                    <Share2 className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Comments Section */}
                            <div className="mt-6">
                                <h3 className="text-lg font-semibold text-white mb-4">
                                    Comments ({comments.length})
                                </h3>

                                {/* Add Comment */}
                                <div className="flex gap-3 mb-6">
                                    <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                                        <Users className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <div className="flex-1">
                                        <textarea
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            placeholder="Write a comment..."
                                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            rows={2}
                                        />
                                        <div className="flex justify-end mt-2">
                                            <button
                                                onClick={handleAddComment}
                                                disabled={!newComment.trim() || isSubmitting}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <Send className="w-4 h-4" />
                                                Post Comment
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Comments List */}
                                <div className="space-y-4">
                                    {comments.map((comment) => (
                                        <div key={comment.id} className="flex gap-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                                                <span className="text-white font-semibold text-sm">
                                                    {(comment.author?.name || 'U').charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="flex-1">
                                                <div className="bg-gray-700/50 rounded-lg p-3">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-white text-sm font-medium">{comment.author?.name || 'Unknown'}</span>
                                                        <span className={`text-xs ${roleColors[comment.author?.role || ''] || 'text-gray-400'}`}>
                                                            {comment.author?.role || 'Member'}
                                                        </span>
                                                        <span className="text-xs text-gray-500">{formatDate(comment.createdAt)}</span>
                                                    </div>
                                                    <p className="text-gray-300 text-sm whitespace-pre-wrap">{comment.content}</p>
                                                </div>
                                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                    <button className="hover:text-blue-400 transition-colors flex items-center gap-1">
                                                        <ThumbsUp className="w-3 h-3" />
                                                        {comment.likes}
                                                    </button>
                                                    <button className="hover:text-blue-400 transition-colors">Reply</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* New Post Modal */}
            {showNewPostModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl border border-gray-700">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white">Create New Post</h3>
                            <button
                                onClick={() => setShowNewPostModal(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Category</label>
                                <select
                                    value={newPostCategory}
                                    onChange={(e) => setNewPostCategory(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="GENERAL">General</option>
                                    <option value="INVESTOR_INSIGHT">Investor Insight</option>
                                    <option value="SME_NEWS">SME News</option>
                                    <option value="QUESTION">Question</option>
                                    <option value="SUCCESS_STORY">Success Story</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Title</label>
                                <input
                                    type="text"
                                    value={newPostTitle}
                                    onChange={(e) => setNewPostTitle(e.target.value)}
                                    placeholder="Enter a descriptive title..."
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Content</label>
                                <textarea
                                    value={newPostContent}
                                    onChange={(e) => setNewPostContent(e.target.value)}
                                    placeholder="Share your thoughts, insights, or questions..."
                                    rows={8}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowNewPostModal(false)}
                                    className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreatePost}
                                    disabled={isSubmitting || !newPostTitle.trim() || !newPostContent.trim()}
                                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isSubmitting ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                    ) : (
                                        <>
                                            <Send className="w-5 h-5" />
                                            Publish Post
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}
