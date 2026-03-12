import { useSocketContext } from '../contexts/SocketContext';

export const useSocket = (token?: string | null) => {
    // Token argument is ignored as SocketContext manages authentication state globally
    return useSocketContext();
};
