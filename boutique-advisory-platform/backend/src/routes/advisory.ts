import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize, requireRole } from '../middleware/authorize';
import { prisma } from '../database';
import { sendNewBookingNotification, sendBookingConfirmation, sendPaymentReceiptEmail } from '../utils/email';
import { logAuditEvent } from '../utils/security';

const router = Router();
const advisoryServiceStatusTransitions: Record<string, string[]> = {
    ACTIVE: ['INACTIVE'],
    INACTIVE: ['ACTIVE']
};
const advisoryServiceStatuses = new Set(['ACTIVE', 'INACTIVE']);
const certificationTransitions: Record<string, string[]> = {
    PENDING: ['APPROVED', 'REJECTED'],
    APPROVED: [],
    REJECTED: []
};

function requireTenantId(req: AuthenticatedRequest, res: Response): string | undefined {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
        res.status(403).json({ error: 'Tenant context required' });
        return undefined;
    }
    return tenantId;
}

// Get all advisory services
router.get('/services', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        const services = await prisma.advisoryService.findMany({
            where: { status: 'ACTIVE', tenantId },
            include: {
                advisor: {
                    select: {
                        id: true,
                        name: true,
                        specialization: true
                    }
                }
            }
        });

        // Return empty array if no services found
        if (services.length === 0) {
            return res.json([]);
        }

        return res.json(services);
    } catch (error) {
        console.error('Error fetching services:', error);
        return res.status(500).json({ error: 'Failed to fetch advisory services' });
    }
});

// Get single advisory service
router.get('/services/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        const { id } = req.params;



        const service = await prisma.advisoryService.findFirst({
            where: { id, tenantId },
            include: {
                advisor: {
                    select: {
                        id: true,
                        name: true,
                        specialization: true
                    }
                }
            }
        });

        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }

        return res.json(service);
    } catch (error) {
        console.error('Error fetching service:', error);
        return res.status(500).json({ error: 'Failed to fetch advisory service' });
    }
});

// Get all advisors
router.get('/advisors', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        const advisors = await prisma.advisor.findMany({
            where: { status: 'ACTIVE', tenantId },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                services: true
            }
        });

        if (advisors.length === 0) {
            return res.json([]);
        }

        return res.json(advisors);
    } catch (error) {
        console.error('Error fetching advisors:', error);
        return res.status(500).json({ error: 'Failed to fetch advisors' });
    }
});

// Get single advisor
router.get('/advisors/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        const { id } = req.params;



        const advisor = await prisma.advisor.findFirst({
            where: { id, tenantId },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                services: {
                    where: { status: 'ACTIVE' }
                }
            }
        });

        if (!advisor) {
            return res.status(404).json({ error: 'Advisor not found' });
        }

        // Format response
        const formattedAdvisor = {
            ...advisor,
            name: `${advisor.user.firstName} ${advisor.user.lastName}`,
            email: advisor.user.email,
            // Production fields
            role: advisor.specialization?.[0] || 'Professional Advisor',
            rating: null,
            image: `https://ui-avatars.com/api/?name=${encodeURIComponent(advisor.user.firstName)}+${encodeURIComponent(advisor.user.lastName)}`,
            bio: advisor.specialization ? `Expert in ${advisor.specialization.join(', ')}` : 'Professional Advisor'
        };

        return res.json(formattedAdvisor);
    } catch (error) {
        console.error('Error fetching advisor:', error);
        return res.status(500).json({ error: 'Failed to fetch advisor' });
    }
});

// Book a service or session
router.post('/book', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { serviceId, serviceName, advisorId, preferredDate, notes, amount } = req.body;
        const userId = req.user?.id;
        const tenantId = requireTenantId(req, res);

        if (!tenantId) return;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // Check if service exists in DB, if not, create booking without foreign key
        let actualServiceId = null;
        let actualAdvisorId = null;

        if (serviceId) {
            const serviceExists = await prisma.advisoryService.findFirst({
                where: { id: serviceId, tenantId }
            });
            if (serviceExists && serviceExists.status === 'ACTIVE') {
                actualServiceId = serviceId;
                actualAdvisorId = serviceExists.advisorId;
            }
        }

        if (advisorId && !actualAdvisorId) {
            const advisorExists = await prisma.advisor.findFirst({
                where: { id: advisorId, tenantId }
            });
            if (advisorExists && advisorExists.status === 'ACTIVE') {
                actualAdvisorId = advisorId;
            }
        }

        // Enhanced notes with service info if using mock data
        const enhancedNotes = actualServiceId
            ? notes
            : `Service: ${serviceName || 'Consultation'}\n${notes || ''}`;

        // Check availability (prevent double booking)
        if (actualAdvisorId) {
            const bookingDate = new Date(preferredDate);
            const durationMs = 60 * 60 * 1000; // Default 1 hour
            const endTime = new Date(bookingDate.getTime() + durationMs);

            const conflicts = await prisma.booking.findMany({
                where: {
                    tenantId,
                    advisorId: actualAdvisorId,
                    status: { in: ['CONFIRMED', 'PENDING'] },
                    preferredDate: {
                        gte: new Date(bookingDate.getTime() - durationMs + 1), // Overlap check
                        lt: endTime
                    }
                }
            });

            if (conflicts.length > 0) {
                return res.status(409).json({ error: 'Advisor is not available at this time. Please choose another slot.' });
            }
        }

        const booking = await prisma.booking.create({
            data: {
                userId,
                tenantId,
                serviceId: actualServiceId,
                advisorId: actualAdvisorId,
                preferredDate: new Date(preferredDate),
                notes: enhancedNotes,
                amount: amount ? parseFloat(amount) : null,
                status: amount ? 'CONFIRMED' : 'PENDING'
            },
            include: {
                service: true,
                advisor: {
                    include: {
                        user: true
                    }
                },
                user: true
            }
        });
        await logAuditEvent({
            userId: userId,
            tenantId,
            action: 'ADVISORY_BOOKING_CREATED',
            resource: 'booking',
            resourceId: booking.id,
            details: {
                serviceId: actualServiceId,
                advisorId: actualAdvisorId,
                status: booking.status
            },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] as string | undefined,
            success: true
        });

        // Send emails
        if (booking.advisor && booking.advisor.user) {
            const clientName = `${booking.user.firstName} ${booking.user.lastName}`;
            const serviceName = booking.service?.name || 'Consultation Session';

            // Notify Advisor
            await sendNewBookingNotification(
                booking.advisor.user.email,
                `${booking.advisor.user.firstName} ${booking.advisor.user.lastName}`,
                clientName,
                serviceName,
                booking.preferredDate,
                enhancedNotes
            );

            // If confirmed (paid), notify User
            if (booking.status === 'CONFIRMED') {
                await sendBookingConfirmation(
                    booking.user.email,
                    clientName,
                    serviceName,
                    `${booking.advisor.user.firstName} ${booking.advisor.user.lastName}`,
                    booking.preferredDate
                );

                if (amount) {
                    await sendPaymentReceiptEmail(
                        booking.user.email,
                        clientName,
                        parseFloat(amount),
                        `Booking: ${serviceName}`,
                        `txn_${Date.now()}` // Mock transaction ID
                    );
                }
            }
        }

        return res.status(201).json({
            message: 'Booking successful',
            booking
        });
    } catch (error) {
        console.error('Booking error:', error);
        return res.status(500).json({ error: 'Failed to process booking' });
    }
});

// Get my bookings (Anyone authenticated can see their own)
router.get('/my-bookings', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        const bookings = await prisma.booking.findMany({
            where: { userId, tenantId },
            include: {
                service: true,
                advisor: true
            },
            orderBy: { createdAt: 'desc' }
        });
        return res.json(bookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        return res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

// ==================== SERVICE MANAGEMENT (For Advisors/Admins) ====================

// Create a new advisory service (Advisor/Admin only)
router.post('/services', authorize('advisory_service.create'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        const { name, category, description, price, duration, features } = req.body;

        // Get advisor profile
        const advisor = await prisma.advisor.findUnique({
            where: { userId },
        });

        if (!advisor || advisor.tenantId !== tenantId) {
            return res.status(403).json({ error: 'Only registered Advisors can create advisory services' });
        }
        if (advisor.status !== 'ACTIVE') {
            return res.status(409).json({ error: 'Advisor must be ACTIVE to create services' });
        }

        const advisorId = advisor.id;

        const service = await prisma.advisoryService.create({
            data: {
                tenantId,
                advisorId,
                name,
                category,
                description,
                price: parseFloat(price),
                duration,
                features: Array.isArray(features) ? features : [features],
                status: 'ACTIVE'
            },
            include: {
                advisor: {
                    select: {
                        id: true,
                        name: true,
                        specialization: true
                    }
                }
            }
        });
        await logAuditEvent({
            userId: userId || 'unknown',
            tenantId,
            action: 'ADVISORY_SERVICE_CREATED',
            resource: 'advisory_service',
            resourceId: service.id,
            details: {
                advisorId,
                status: service.status
            },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] as string | undefined,
            success: true
        });

        return res.status(201).json({
            message: 'Service created successfully',
            service
        });
    } catch (error) {
        console.error('Error creating service:', error);
        return res.status(500).json({ error: 'Failed to create service' });
    }
});

// Update an advisory service
router.put('/services/:id', authorize('advisory_service.manage'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;
        const { id } = req.params;

        // Get the service to check ownership
        const existingService = await prisma.advisoryService.findFirst({
            where: { id, tenantId },
            include: { advisor: true }
        });

        if (!existingService) {
            return res.status(404).json({ error: 'Service not found' });
        }

        // Check if user owns this service or is admin
        if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN' && existingService.advisor.userId !== userId) {
            return res.status(403).json({ error: 'Not authorized to update this service' });
        }

        const { name, category, description, price, duration, features, status } = req.body;
        let normalizedStatus: string | undefined;
        if (status !== undefined) {
            normalizedStatus = String(status).toUpperCase();
            if (!advisoryServiceStatuses.has(normalizedStatus)) {
                return res.status(400).json({ error: 'Invalid service status' });
            }
            if (normalizedStatus !== existingService.status && !(advisoryServiceStatusTransitions[existingService.status] || []).includes(normalizedStatus)) {
                return res.status(409).json({
                    error: `Invalid advisory service status transition: ${existingService.status} -> ${normalizedStatus}`
                });
            }
        }

        const service = await prisma.advisoryService.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(category && { category }),
                ...(description && { description }),
                ...(price && { price: parseFloat(price) }),
                ...(duration && { duration }),
                ...(features && { features: Array.isArray(features) ? features : [features] }),
                ...(normalizedStatus && { status: normalizedStatus })
            },
            include: {
                advisor: {
                    select: {
                        id: true,
                        name: true,
                        specialization: true
                    }
                }
            }
        });
        if (normalizedStatus && normalizedStatus !== existingService.status) {
            await logAuditEvent({
                userId: userId || 'unknown',
                tenantId,
                action: 'ADVISORY_SERVICE_STATUS_TRANSITION',
                resource: 'advisory_service',
                resourceId: service.id,
                details: {
                    fromStatus: existingService.status,
                    toStatus: normalizedStatus
                },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'] as string | undefined,
                success: true
            });
        }

        return res.json({
            message: 'Service updated successfully',
            service
        });
    } catch (error) {
        console.error('Error updating service:', error);
        return res.status(500).json({ error: 'Failed to update service' });
    }
});

// Delete an advisory service
router.delete('/services/:id', authorize('advisory_service.delete'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;
        const { id } = req.params;

        // Get the service to check ownership
        const existingService = await prisma.advisoryService.findFirst({
            where: { id, tenantId },
            include: { advisor: true }
        });

        if (!existingService) {
            return res.status(404).json({ error: 'Service not found' });
        }

        // Check if user owns this service or is admin
        if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN' && existingService.advisor.userId !== userId) {
            return res.status(403).json({ error: 'Not authorized to delete this service' });
        }
        const futureBookings = await prisma.booking.count({
            where: {
                tenantId,
                serviceId: id,
                status: { in: ['PENDING', 'CONFIRMED'] },
                preferredDate: { gte: new Date() }
            }
        });
        if (futureBookings > 0) {
            return res.status(409).json({
                error: 'Cannot deactivate service with pending/confirmed future bookings'
            });
        }

        // Soft delete by setting status to INACTIVE
        await prisma.advisoryService.update({
            where: { id },
            data: { status: 'INACTIVE' }
        });
        await logAuditEvent({
            userId: userId || 'unknown',
            tenantId,
            action: 'ADVISORY_SERVICE_DEACTIVATED',
            resource: 'advisory_service',
            resourceId: id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] as string | undefined,
            success: true
        });

        return res.json({ message: 'Service deleted successfully' });
    } catch (error) {
        console.error('Error deleting service:', error);
        return res.status(500).json({ error: 'Failed to delete service' });
    }
});

// Get my services (for advisors) - Admins see all
router.get('/my-services', authorize('advisory_service.manage'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        // If Admin, return all services
        if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
            const allServices = await prisma.advisoryService.findMany({
                where: { tenantId },
                include: { advisor: true },
                orderBy: { createdAt: 'desc' }
            });
            return res.json(allServices);
        }

        const advisor = await prisma.advisor.findUnique({
            where: { userId }
        });

        if (!advisor || advisor.tenantId !== tenantId) {
            return res.status(404).json({ error: 'Advisor profile not found' });
        }

        const services = await prisma.advisoryService.findMany({
            where: { advisorId: advisor.id, tenantId },
            orderBy: { createdAt: 'desc' }
        });

        return res.json(services);
    } catch (error) {
        console.error('Error fetching my services:', error);
        return res.status(500).json({ error: 'Failed to fetch services' });
    }
});

// ==================== CERTIFICATION MANAGEMENT ====================

// Get certification requests (for Advisors/Admins)
router.get('/certifications', authorize('certification.list'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        const certifications = await prisma.certification.findMany({
            where: { sme: { tenantId } },
            include: {
                sme: {
                    select: {
                        name: true,
                        sector: true,
                        stage: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return res.json({ certifications });
    } catch (error) {
        console.error('Error fetching certifications:', error);
        return res.status(500).json({ error: 'Failed to fetch certifications' });
    }
});

// Update certification status
router.patch('/certifications/:id', authorize('certification.approve'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        const { id } = req.params;
        const { status, comments, score } = req.body;
        const normalizedStatus = String(status || '').toUpperCase();
        if (!['APPROVED', 'REJECTED'].includes(normalizedStatus)) {
            return res.status(400).json({ error: 'status must be APPROVED or REJECTED' });
        }

        const existingCertification = await prisma.certification.findFirst({
            where: { id, sme: { tenantId } },
            select: { id: true, status: true }
        });
        if (!existingCertification) {
            return res.status(404).json({ error: 'Certification not found' });
        }
        if (!(certificationTransitions[existingCertification.status] || []).includes(normalizedStatus)) {
            return res.status(409).json({
                error: `Invalid certification transition: ${existingCertification.status} -> ${normalizedStatus}`
            });
        }

        const certification = await prisma.certification.update({
            where: { id: existingCertification.id },
            data: {
                status: normalizedStatus as any,
                ...(comments && { comments }),
                ...(score && { score: parseFloat(score) })
            },
            include: { sme: true }
        });

        // If approved, update SME status
        if (normalizedStatus === 'APPROVED') {
            await prisma.sME.update({
                where: { id: certification.smeId },
                data: {
                    certified: true,
                    certificationDate: new Date(),
                    status: 'CERTIFIED'
                }
            });
        } else if (normalizedStatus === 'REJECTED') {
            await prisma.sME.update({
                where: { id: certification.smeId },
                data: {
                    certified: false,
                    status: 'REJECTED'
                }
            });
        }
        await logAuditEvent({
            userId: req.user?.id || 'unknown',
            tenantId,
            action: 'CERTIFICATION_STATUS_TRANSITION',
            resource: 'certification',
            resourceId: certification.id,
            details: {
                fromStatus: existingCertification.status,
                toStatus: normalizedStatus,
                smeId: certification.smeId
            },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] as string | undefined,
            success: true
        });

        return res.json({ message: 'Certification updated', certification });
    } catch (error) {
        console.error('Error updating certification:', error);
        return res.status(500).json({ error: 'Failed to update certification' });
    }
});

export default router;
