'use client';

import React from 'react';
import { format, parseISO, eachDayOfInterval, subDays, isToday, isYesterday } from 'date-fns';

interface EmailActivityChartProps {
  emails: Array<{
    received_date: string;
    category_id?: string | null;
  }>;
}

export default function EmailActivityChart({ emails }: EmailActivityChartProps) {
  // Get last 7 days
  const endDate = new Date();
  const startDate = subDays(endDate, 6);
  const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

  // Group emails by date
  const emailsByDate = emails.reduce((acc, email) => {
    const date = format(parseISO(email.received_date), 'yyyy-MM-dd');
    if (!acc[date]) {
      acc[date] = 0;
    }
    acc[date]++;
    return acc;
  }, {} as Record<string, number>);

  // Create chart data for last 7 days
  const chartData = dateRange.map(date => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const count = emailsByDate[dateKey] || 0;
    return {
      date,
      dateKey,
      count,
      label: isToday(date) ? 'Today' : isYesterday(date) ? 'Yesterday' : format(date, 'MMM d')
    };
  });

  const maxCount = Math.max(...chartData.map(d => d.count), 1);

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-900">Email Activity</h3>
        <span className="text-sm text-slate-500">Last 7 days</span>
      </div>

      <div className="space-y-4">
        {/* Chart */}
        <div className="h-40 flex items-end space-x-2">
          {chartData.map((item) => (
            <div key={item.dateKey} className="flex-1 flex flex-col items-center">
              {/* Bar */}
              <div className="w-full flex items-end justify-center mb-2">
                <div
                  className="bg-blue-500 hover:bg-blue-600 transition-colors rounded-t-sm min-h-[4px] w-8 relative group cursor-pointer"
                  style={{
                    height: `${(item.count / maxCount) * 120 + 4}px`
                  }}
                  title={`${item.label}: ${item.count} emails`}
                >
                  {/* Count label on hover */}
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {item.count} emails
                  </div>
                </div>
              </div>
              
              {/* Date label */}
              <div className="text-xs text-slate-600 text-center">
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200">
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-900">
              {chartData.reduce((sum, item) => sum + item.count, 0)}
            </div>
            <div className="text-sm text-slate-500">Total this week</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-900">
              {Math.round(chartData.reduce((sum, item) => sum + item.count, 0) / 7)}
            </div>
            <div className="text-sm text-slate-500">Daily average</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-900">
              {chartData[chartData.length - 1].count}
            </div>
            <div className="text-sm text-slate-500">Today</div>
          </div>
        </div>
      </div>
    </div>
  );
}