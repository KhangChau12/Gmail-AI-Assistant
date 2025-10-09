'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';

interface SyncStatus {
  isActive: boolean;
  message: string;
  progress: number;
  processedCount: number;
  totalEmails: number;
}

interface SyncContextType {
  syncStatus: SyncStatus;
  lastSync: Date | null;
  isAutoSyncing: boolean;
  startManualSync: () => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function useSyncStatus() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSyncStatus must be used within SyncProvider');
  }
  return context;
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isActive: false,
    message: 'Ready',
    progress: 0,
    processedCount: 0,
    totalEmails: 0
  });
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const autoSyncInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Start streaming sync function
  const startStreamingSync = () => {
    console.log('SyncProvider: startStreamingSync called, current state:', {
      hasEventSource: !!eventSourceRef.current,
      isAutoSyncing: isAutoSyncing
    });
    
    // Clean up any existing connection first
    if (eventSourceRef.current) {
      console.log('SyncProvider: Cleaning up existing connection before starting new one');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    // Don't start if already syncing
    if (isAutoSyncing) {
      console.log('SyncProvider: Skipping sync - already in progress');
      return;
    }

    console.log('SyncProvider: Starting automatic email sync...');
    setIsAutoSyncing(true);

    // Update sync status
    setSyncStatus({
      isActive: true,
      message: 'Checking for new emails...',
      progress: 0,
      processedCount: 0,
      totalEmails: 0
    });

    // Create EventSource for streaming sync
    const params = new URLSearchParams({
      folder: 'INBOX',
      limit: '500', // Sync only 500 newest emails
      onlyUnread: 'false' // Process ALL emails, not just unread
    });

    const eventSource = new EventSource(`/api/gmail/stream?${params}`);
    eventSourceRef.current = eventSource;

    // Add connection timeout
    let connectionTimeout: NodeJS.Timeout | null = null;

    const resetTimeout = () => {
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
      }
      // Set timeout for 5 minutes
      connectionTimeout = setTimeout(() => {
        console.log('SyncProvider: Connection timeout - no messages for 5 minutes, reconnecting...');
        stopStreamingSync();
        setTimeout(() => {
          startStreamingSync();
        }, 5000);
      }, 5 * 60 * 1000);
    };

    resetTimeout();

    eventSource.onmessage = (event) => {
      try {
        resetTimeout();
        const data = JSON.parse(event.data);
        handleSyncEvent(data);
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SyncProvider: SSE error:', error);
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
      
      // Check if this is a connection failure vs normal close
      const wasManualClose = eventSourceRef.current === null;
      stopStreamingSync();
      
      // Only retry if it wasn't a manual close
      if (!wasManualClose) {
        console.log('SyncProvider: Will retry sync in 15 seconds due to error...');
        setTimeout(() => {
          if (!eventSourceRef.current) {
            startStreamingSync();
          }
        }, 15000);
      }
    };
  };

  const stopStreamingSync = () => {
    if (eventSourceRef.current) {
      console.log('SyncProvider: Closing EventSource connection');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsAutoSyncing(false);
  };

  const handleSyncEvent = (data: any) => {
    console.log('SyncProvider: Sync event received:', data.type, data.message);
    
    switch (data.type) {
      case 'status':
      case 'processing':
        setSyncStatus({
          isActive: true,
          message: data.message,
          progress: data.progress || 0,
          processedCount: data.processedCount || 0,
          totalEmails: data.totalEmails || 0
        });
        break;

      case 'email_processed':
        console.log('SyncProvider: New email processed:', data.email?.subject);
        setSyncStatus({
          isActive: true,
          message: data.message,
          progress: data.progress || 0,
          processedCount: data.processedCount || 0,
          totalEmails: data.totalEmails || 0
        });
        
        // Trigger dashboard refresh for every 10 new emails
        if (data.processedCount && data.processedCount % 10 === 0) {
          // Emit a custom event that dashboard can listen to
          window.dispatchEvent(new CustomEvent('emailsUpdated', { 
            detail: { count: data.processedCount } 
          }));
        }
        break;

      case 'completed':
        console.log('SyncProvider: Sync completed, processed:', data.processedCount);
        setSyncStatus({
          isActive: false,
          message: data.message,
          progress: 100,
          processedCount: data.processedCount || 0,
          totalEmails: data.totalEmails || 0
        });
        setLastSync(new Date());
        stopStreamingSync();
        break;

      case 'error':
        console.error('SyncProvider: Sync error:', data.error);
        setSyncStatus({
          isActive: false,
          message: `Error: ${data.error}`,
          progress: 0,
          processedCount: 0,
          totalEmails: 0
        });
        stopStreamingSync();
        break;
    }
  };

  const startAutoSync = () => {
    console.log('SyncProvider: startAutoSync called');
    if (autoSyncInterval.current) return; // Already running

    console.log('SyncProvider: Starting initial sync and setting up interval...');
    
    // Initial sync
    startStreamingSync();

    // Set up periodic sync every 5 minutes
    autoSyncInterval.current = setInterval(() => {
      console.log('SyncProvider: Interval triggered, checking if sync needed...');
      // Only start if not already syncing
      if (!eventSourceRef.current && !isAutoSyncing) {
        startStreamingSync();
      } else {
        console.log('SyncProvider: Sync already active, skipping interval trigger');
      }
    }, 5 * 60 * 1000);
  };

  const pauseAutoSync = () => {
    console.log('SyncProvider: Pausing auto-sync...');
    if (autoSyncInterval.current) {
      clearInterval(autoSyncInterval.current);
      autoSyncInterval.current = null;
    }
    stopStreamingSync();
  };

  // Setup auto-sync on mount
  useEffect(() => {
    console.log('SyncProvider: Mounting, starting auto-sync...');
    startAutoSync();

    return () => {
      console.log('SyncProvider: Unmounting, cleaning up...');
      pauseAutoSync();
    };
  }, []);

  const startManualSync = () => {
    console.log('SyncProvider: Manual sync requested');
    startStreamingSync();
  };

  return (
    <SyncContext.Provider value={{
      syncStatus,
      lastSync,
      isAutoSyncing,
      startManualSync
    }}>
      {children}
    </SyncContext.Provider>
  );
}