'use client';

import React from 'react';

interface EmailDistributionChartProps {
  categories: Array<{
    category: {
      id: string;
      name: string;
      color: string;
    };
    count: number;
  }>;
  totalEmails: number;
}

export default function EmailDistributionChart({ categories, totalEmails }: EmailDistributionChartProps) {
  // Safety check for categories
  if (!categories || categories.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Email Distribution</h3>
          <span className="text-sm text-slate-500">0 total emails</span>
        </div>
        <div className="text-center py-8 text-slate-500">
          <p>No email data available</p>
        </div>
      </div>
    );
  }

  // Calculate percentages and create pie chart data
  const chartData = categories.map((item, index) => {
    const percentage = totalEmails > 0 ? (item.count / totalEmails) * 100 : 0;
    return {
      ...item,
      percentage: Math.round(percentage * 100) / 100,
      startAngle: 0, // Will be calculated
      endAngle: 0    // Will be calculated
    };
  });

  // Calculate cumulative angles for pie slices
  let cumulativeAngle = 0;
  chartData.forEach((item) => {
    item.startAngle = cumulativeAngle;
    item.endAngle = cumulativeAngle + (item.percentage / 100) * 360;
    cumulativeAngle = item.endAngle;
  });

  // Function to create SVG path for pie slice
  const createPieSlice = (startAngle: number, endAngle: number, radius = 80) => {
    const start = polarToCartesian(100, 100, radius, endAngle);
    const end = polarToCartesian(100, 100, radius, startAngle);
    const arcSweep = endAngle - startAngle <= 180 ? "0" : "1";
    
    return `M 100,100 L ${start.x},${start.y} A ${radius},${radius} 0 ${arcSweep},0 ${end.x},${end.y} z`;
  };

  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Email Distribution</h3>
        <span className="text-sm text-slate-500">{totalEmails} total emails</span>
      </div>
      
      <div className="flex items-center space-x-8">
        {/* Pie Chart */}
        <div className="flex-shrink-0">
          <svg width="200" height="200" viewBox="0 0 200 200" className="transform -rotate-90">
            {chartData.map((item, index) => {
              if (item.count === 0) return null;
              return (
                <path
                  key={item.category.id}
                  d={createPieSlice(item.startAngle, item.endAngle)}
                  fill={item.category.color}
                  stroke="white"
                  strokeWidth="2"
                  className="hover:opacity-80 transition-opacity cursor-pointer"
                  title={`${item.category.name}: ${item.count} emails (${item.percentage}%)`}
                />
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-3">
          {chartData.map((item) => (
            <div key={item.category.id} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-4 h-4 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: item.category.color }}
                ></div>
                <span className="text-sm text-slate-700 truncate max-w-[150px]" title={item.category.name}>
                  {item.category.name}
                </span>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-slate-900">{item.count}</div>
                <div className="text-xs text-slate-500">{item.percentage}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}