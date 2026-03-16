import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma } from '../database';

const router = Router();

interface CalendarEventPayload {
  title: string;
  description: string;
  type: string;
  startTime: string;
  endTime: string;
  location: string;
  meetingLink: string | null;
  attendees: unknown[];
  dealId: string | null;
  status: string;
  color: string;
}

const DEFAULT_EVENT_STATUS = 'SCHEDULED';
const EVENT_ENTITY_TYPE = 'CALENDAR_EVENT';
const EVENT_CREATED_ACTION = 'CALENDAR_EVENT_CREATED';
const EVENT_DELETED_ACTION = 'CALENDAR_EVENT_DELETED';

function getEventColor(type: string): string {
  switch (type) {
    case 'PITCH_SESSION':
      return '#3B82F6';
    case 'DUE_DILIGENCE':
      return '#F59E0B';
    case 'NEGOTIATION':
      return '#10B981';
    case 'CLOSING':
      return '#8B5CF6';
    default:
      return '#6B7280';
  }
}

function parseEventPayload(input: unknown): { valid: true; value: CalendarEventPayload } | { valid: false; error: string } {
  const body = (input ?? {}) as Record<string, unknown>;
  const title = String(body.title ?? '').trim();
  const description = String(body.description ?? '').trim();
  const type = String(body.type ?? 'GENERAL').trim() || 'GENERAL';
  const startTime = String(body.startTime ?? '').trim();
  const endTime = String(body.endTime ?? '').trim();
  const location = String(body.location ?? 'Virtual').trim() || 'Virtual';
  const rawMeetingLink = body.meetingLink;
  const meetingLink = typeof rawMeetingLink === 'string' && rawMeetingLink.trim().length > 0
    ? rawMeetingLink.trim()
    : null;

  if (!title) {
    return { valid: false, error: 'Title is required' };
  }

  if (!startTime || !endTime) {
    return { valid: false, error: 'startTime and endTime are required' };
  }

  const parsedStart = new Date(startTime);
  const parsedEnd = new Date(endTime);
  if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
    return { valid: false, error: 'Invalid date format for startTime or endTime' };
  }
  if (parsedEnd <= parsedStart) {
    return { valid: false, error: 'endTime must be later than startTime' };
  }

  return {
    valid: true,
    value: {
      title,
      description,
      type,
      startTime: parsedStart.toISOString(),
      endTime: parsedEnd.toISOString(),
      location,
      meetingLink,
      attendees: [],
      dealId: typeof body.dealId === 'string' && body.dealId.trim().length > 0 ? body.dealId.trim() : null,
      status: DEFAULT_EVENT_STATUS,
      color: getEventColor(type)
    }
  };
}

// Get calendar events
router.get('/', authorize('calendar.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const logs = await prisma.activityLog.findMany({
      where: {
        tenantId,
        entityType: EVENT_ENTITY_TYPE,
        action: EVENT_CREATED_ACTION
      },
      orderBy: { timestamp: 'asc' }
    });

    const events = logs.map((log) => {
      const metadata = (log.metadata ?? {}) as Record<string, unknown>;
      return {
        id: log.id,
        title: String(metadata.title ?? ''),
        description: String(metadata.description ?? ''),
        type: String(metadata.type ?? 'GENERAL'),
        startTime: String(metadata.startTime ?? log.timestamp.toISOString()),
        endTime: String(metadata.endTime ?? log.timestamp.toISOString()),
        location: String(metadata.location ?? 'Virtual'),
        meetingLink: typeof metadata.meetingLink === 'string' ? metadata.meetingLink : null,
        attendees: Array.isArray(metadata.attendees) ? metadata.attendees : [],
        dealId: typeof metadata.dealId === 'string' ? metadata.dealId : null,
        status: String(metadata.status ?? DEFAULT_EVENT_STATUS),
        color: String(metadata.color ?? getEventColor(String(metadata.type ?? 'GENERAL'))),
        createdAt: log.timestamp.toISOString()
      };
    });

    return res.json({ events });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create calendar event
router.post('/', authorize('calendar.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) {
      return res.status(403).json({ error: 'Tenant and user context required' });
    }

    const parsed = parseEventPayload(req.body);
    if (!parsed.valid) {
      return res.status(400).json({ error: parsed.error });
    }

    const created = await prisma.activityLog.create({
      data: {
        tenantId,
        userId,
        action: EVENT_CREATED_ACTION,
        entityId: 'calendar',
        entityType: EVENT_ENTITY_TYPE,
        metadata: parsed.value as any
      }
    });

    return res.status(201).json({
      id: created.id,
      ...parsed.value,
      createdAt: created.timestamp.toISOString()
    });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete calendar event
router.delete('/:eventId', authorize('calendar.delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { eventId } = req.params;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const event = await prisma.activityLog.findFirst({
      where: {
        id: eventId,
        tenantId,
        entityType: EVENT_ENTITY_TYPE,
        action: EVENT_CREATED_ACTION
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    await prisma.activityLog.update({
      where: { id: eventId },
      data: {
        action: EVENT_DELETED_ACTION
      }
    });

    return res.json({ message: 'Event deleted' });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
