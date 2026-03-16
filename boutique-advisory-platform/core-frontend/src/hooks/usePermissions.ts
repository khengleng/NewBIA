'use client';

/**
 * usePermissions Hook
 * 
 * Provides centralized permission checks for React components.
 * Eliminates scattered role checks across the codebase.
 * 
 * Usage:
 * const { canCreateSME, canEditDeal, isAdmin } = usePermissions();
 * 
 * {canCreateSME && <button>Add SME</button>}
 */

import { useState, useEffect, useMemo, ReactNode } from 'react';
import {
    createPermissionHelpers,
    PermissionHelpers,
    User,
    UserRole,
    Resource,
    PermissionAction,
    hasPermission as checkPermission,
    canPerformAction
} from '../lib/permissions';
import { authorizedRequest } from '../lib/api';
import { normalizeRole } from '../lib/roles';

/**
 * Get current user from localStorage
 */
function getCurrentUser(): User | null {
    return null;
}

/**
 * Main permissions hook
 */
export function usePermissions(): PermissionHelpers & {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
} {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const loadUser = async (strictFreshIdentity: boolean = false) => {
            const cachedUser = getCurrentUser();
            if (cachedUser && isMounted) {
                setUser(cachedUser);
                setIsLoading(false);
            }

            try {
                const response = await authorizedRequest('/api/auth/me');
                if (!response.ok) {
                    if (response.status === 401) {
                        localStorage.removeItem('user');
                        if (isMounted) {
                            setUser(null);
                        }
                    }
                    return;
                }

                const payload = await response.json();
                const apiUser = payload?.user;
                if (!apiUser) {
                    return;
                }

                const normalizedApiUser: User = {
                    ...apiUser,
                    role: normalizeRole(apiUser.role),
                };

                localStorage.setItem('user', JSON.stringify(normalizedApiUser));
                if (isMounted) {
                    setUser(normalizedApiUser);
                }
            } catch {
                // In trading runtime we prefer consistency over optimistic fallback
                // to prevent stale persona rendering after SSO/session switches.
                if (strictFreshIdentity && isMounted) {
                    localStorage.removeItem('user');
                    setUser(null);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        const isTradingContext = false;

        // Trading runtime should not optimistically render cached persona data.
        void loadUser(isTradingContext);

        // Listen for storage changes (e.g., login/logout in another tab)
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'user') {
                void loadUser(isTradingContext);
            }
        };

        // Listen for same-tab auth changes dispatched after login/logout/SSO
        const handleAuthChanged = () => {
            void loadUser(isTradingContext);
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('auth:changed', handleAuthChanged as EventListener);
        return () => {
            isMounted = false;
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('auth:changed', handleAuthChanged as EventListener);
        };
    }, []);

    const helpers = useMemo(() => createPermissionHelpers(user), [user]);

    return {
        ...helpers,
        user,
        isLoading,
        isAuthenticated: !!user,
    };
}

/**
 * Hook to check a specific permission
 */
export function useHasPermission(
    permission: string,
    isOwner: boolean = false
): boolean {
    const { user } = usePermissions();
    return checkPermission(user?.role, permission, isOwner);
}

/**
 * Hook to check if user can perform an action on a resource
 */
export function useCanPerform(
    resource: Resource,
    action: PermissionAction,
    isOwner: boolean = false
): boolean {
    const { user } = usePermissions();
    return canPerformAction(user?.role, resource, action, isOwner);
}

/**
 * Hook for resource-specific ownership checks
 */
export function useResourcePermissions(resourceOwnerId?: string) {
    const { user, ...permissions } = usePermissions();

    const isOwner = !!(user && resourceOwnerId && user.id === resourceOwnerId);

    return {
        ...permissions,
        user,
        isOwner,
        // Override methods with owner context
        canEditSME: permissions.canEditSME(isOwner),
        canEditInvestor: permissions.canEditInvestor(isOwner),
        canEditDeal: permissions.canEditDeal(isOwner),
        canUploadDocument: permissions.canUploadDocument(isOwner),
        canDownloadDocument: permissions.canDownloadDocument(isOwner),
        canDeleteDocument: permissions.canDeleteDocument(isOwner),
    };
}

/**
 * Props for conditional rendering components
 */
interface ConditionalRenderProps {
    children: ReactNode;
    fallback?: ReactNode;
}

interface PermissionProps extends ConditionalRenderProps {
    permission: string;
    isOwner?: boolean;
}

interface RoleProps extends ConditionalRenderProps {
    roles: UserRole[];
}

interface OwnerProps extends ConditionalRenderProps {
    ownerId?: string;
}

/**
 * Component for conditional rendering based on permission
 */
export function IfPermission({
    permission,
    isOwner = false,
    children,
    fallback = null
}: PermissionProps): ReactNode {
    const hasAccess = useHasPermission(permission, isOwner);
    if (hasAccess) {
        return children;
    }
    return fallback;
}

/**
 * Component for role-based rendering
 */
export function IfRole({
    roles,
    children,
    fallback = null
}: RoleProps): ReactNode {
    const { user } = usePermissions();
    const hasRole = user && roles.includes(normalizeRole(user.role) as UserRole);
    if (hasRole) {
        return children;
    }
    return fallback;
}

/**
 * Component for admin-only content
 */
export function AdminOnly({
    children,
    fallback = null
}: ConditionalRenderProps): ReactNode {
    const { isAdmin } = usePermissions();
    if (isAdmin) {
        return children;
    }
    return fallback;
}

/**
 * Component for owner-based content
 */
export function OwnerOnly({
    ownerId,
    children,
    fallback = null
}: OwnerProps): ReactNode {
    const { user, isAdmin } = usePermissions();
    const isOwner = user && ownerId && user.id === ownerId;

    // Admins can also see owner content
    if (isOwner || isAdmin) {
        return children;
    }
    return fallback;
}

export default usePermissions;
