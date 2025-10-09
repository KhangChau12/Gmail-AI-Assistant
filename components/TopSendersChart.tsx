'use client';

import React from 'react';

interface TopSendersChartProps {
  emails: Array<{
    sender_email: string;
    sender_name?: string | null;
    received_date: string;
  }>;
}

export default function TopSendersChart({ emails }: TopSendersChartProps) {
  // Group emails by sender
  const senderStats = emails.reduce((acc, email) => {
    const key = email.sender_email;
    if (!acc[key]) {
      acc[key] = {
        email: email.sender_email,
        name: email.sender_name || email.sender_email.split('@')[0],
        count: 0,
        lastReceived: email.received_date
      };
    }
    acc[key].count++;
    if (new Date(email.received_date) > new Date(acc[key].lastReceived)) {
      acc[key].lastReceived = email.received_date;
    }
    return acc;
  }, {} as Record<string, { email: string; name: string; count: number; lastReceived: string }>);

  // Get top 5 senders
  const topSenders = Object.values(senderStats)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const maxCount = Math.max(...topSenders.map(s => s.count), 1);

  // Get domain from email for favicon
  const getDomainIcon = (email: string) => {
    const domain = email.split('@')[1];
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    const diffInWeeks = Math.floor(diffInDays / 7);
    return `${diffInWeeks}w ago`;
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-900">Top Senders</h3>
        <span className="text-sm text-slate-500">{Object.keys(senderStats).length} unique senders</span>
      </div>

      <div className="space-y-4">
        {topSenders.map((sender, index) => (
          <div key={sender.email} className="flex items-center space-x-4">
            {/* Rank */}
            <div className="flex-shrink-0 w-6 text-center">
              <span className="text-sm font-medium text-slate-500">#{index + 1}</span>
            </div>

            {/* Sender info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <img 
                  src={getDomainIcon(sender.email)}
                  alt=""
                  className="w-4 h-4 rounded-sm"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span className="text-sm font-medium text-slate-900 truncate">
                  {sender.name}
                </span>
              </div>
              <div className="text-xs text-slate-500 truncate">{sender.email}</div>
            </div>

            {/* Bar chart */}
            <div className="flex-shrink-0 w-24">
              <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(sender.count / maxCount) * 100}%`
                  }}
                ></div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex-shrink-0 text-right">
              <div className="text-sm font-medium text-slate-900">{sender.count}</div>
              <div className="text-xs text-slate-500">{formatRelativeTime(sender.lastReceived)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-slate-200">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-lg font-bold text-slate-900">
              {topSenders.reduce((sum, sender) => sum + sender.count, 0)}
            </div>
            <div className="text-sm text-slate-500">From top 5</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-slate-900">
              {Math.round((topSenders.reduce((sum, sender) => sum + sender.count, 0) / emails.length) * 100)}%
            </div>
            <div className="text-sm text-slate-500">Of all emails</div>
          </div>
        </div>
      </div>
    </div>
  );
}