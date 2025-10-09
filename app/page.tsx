'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSyncStatus } from '@/components/SyncProvider';
import { 
  Mail, 
  RefreshCw, 
  Settings, 
  Plus, 
  Search, 
  Inbox, 
  Send,
  Archive,
  Trash2,
  Tag,
  Users,
  BarChart3,
  Clock,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import ChatBox from '@/components/ChatBox';
import EmailList from '@/components/EmailList';
import EmailDistributionChart from '@/components/EmailDistributionChart';
import EmailActivityChart from '@/components/EmailActivityChart';
import TopSendersChart from '@/components/TopSendersChart';
import { 
  Category, 
  ProcessedEmail, 
  AppContext, 
  ChatResponse,
  EmailSummary 
} from '@/types';
import { cn, formatNumber, createEmailDetailUrl } from '@/lib/utils';

interface SyncStatus {
  isActive: boolean;
  message: string;
  progress: number;
  processedCount: number;
  totalEmails: number;
}

export default function Dashboard() {
  const router = useRouter();
  const { syncStatus, lastSync, isAutoSyncing, startManualSync } = useSyncStatus();
  const [categories, setCategories] = useState<Category[]>([]);
  const [emailSummary, setEmailSummary] = useState<EmailSummary | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmailList, setShowEmailList] = useState(false);
  const [recentlyUpdatedCategories, setRecentlyUpdatedCategories] = useState<Set<string>>(new Set());
  const [allEmails, setAllEmails] = useState<ProcessedEmail[]>([]);

  // App context for ChatBox
  const appContext: AppContext = {
    currentPage: 'dashboard',
    gmailFolders: [], // Will be populated
  };

  useEffect(() => {
    loadInitialData();
    
    // Listen for custom email update events from SyncProvider
    const handleEmailsUpdated = () => {
      console.log('Dashboard: Emails updated event received, refreshing data...');
      fetchEmailSummary();
      fetchCategories();
      fetchAllEmails();
    };
    
    window.addEventListener('emailsUpdated', handleEmailsUpdated);
    return () => window.removeEventListener('emailsUpdated', handleEmailsUpdated);
  }, []);

  // Listen to sync status changes from the global provider
  useEffect(() => {
    // Refresh email summary when sync completes
    if (!syncStatus.isActive && syncStatus.progress === 100) {
      fetchEmailSummary();
      fetchCategories();
    }
    
    // Also refresh periodically during active sync (every 10 seconds)
    if (syncStatus.isActive && syncStatus.processedCount > 0) {
      const refreshInterval = setInterval(() => {
        fetchEmailSummary();
        fetchCategories();
        fetchAllEmails();
      }, 10000);
      
      return () => clearInterval(refreshInterval);
    }
  }, [syncStatus]);

  const loadInitialData = async () => {
    await Promise.all([
      fetchCategories(),
      fetchEmailSummary(),
      fetchAllEmails(),
      fetchGmailFolders()
    ]);
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/db?resource=categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchEmailSummary = async () => {
    try {
      const response = await fetch('/api/db?resource=summary');
      if (response.ok) {
        const data = await response.json();
        setEmailSummary(data);
      }
    } catch (error) {
      console.error('Error fetching email summary:', error);
    }
  };

  const fetchGmailFolders = async () => {
    try {
      const response = await fetch('/api/gmail?action=folders');
      if (response.ok) {
        const folders = await response.json();
        appContext.gmailFolders = folders;
      }
    } catch (error) {
      console.error('Error fetching Gmail folders:', error);
    }
  };

  const fetchAllEmails = async () => {
    try {
      const response = await fetch('/api/db?resource=emails');
      if (response.ok) {
        const data = await response.json();
        setAllEmails(data);
      }
    } catch (error) {
      console.error('Error fetching all emails:', error);
    }
  };

  // Manual sync trigger
  const handleManualSync = () => {
    console.log('Dashboard: Manual sync requested');
    startManualSync();
  };

  const handleManualRefresh = async () => {
    console.log('Dashboard: Manual refresh requested');
    await fetchEmailSummary();
    await fetchCategories();
    await fetchAllEmails();
  };

  // All sync logic is now handled by SyncProvider at the root level


  // Update email summary statistics in real-time
  const updateEmailSummary = (newEmail: any) => {
    const categoryToUpdate = newEmail.category_id || 'uncategorized';
    
    // Add visual feedback for updated category
    setRecentlyUpdatedCategories(prev => new Set([...prev, categoryToUpdate]));
    
    // Remove the highlight after 2 seconds
    setTimeout(() => {
      setRecentlyUpdatedCategories(prev => {
        const newSet = new Set(prev);
        newSet.delete(categoryToUpdate);
        return newSet;
      });
    }, 2000);

    setEmailSummary(prevSummary => {
      if (!prevSummary) {
        // If no summary exists, create a basic one
        return {
          total: 1,
          categories: []
        };
      }

      // Increment total count
      const updatedSummary = {
        ...prevSummary,
        total: prevSummary.total + 1
      };

      // Update category counts
      if (newEmail.category_id) {
        // Find the category and increment its count
        updatedSummary.categories = prevSummary.categories.map(categoryData => {
          if (categoryData.category.id === newEmail.category_id) {
            return {
              ...categoryData,
              count: categoryData.count + 1
            };
          }
          return categoryData;
        });
      } else {
        // If no category, increment uncategorized count
        updatedSummary.categories = prevSummary.categories.map(categoryData => {
          if (categoryData.category.id === 'uncategorized' || !categoryData.category.id) {
            return {
              ...categoryData,
              count: categoryData.count + 1
            };
          }
          return categoryData;
        });

        // If uncategorized doesn't exist, we should add it
        const hasUncategorized = prevSummary.categories.some(cat => 
          cat.category.id === 'uncategorized' || !cat.category.id
        );
        
        if (!hasUncategorized) {
          updatedSummary.categories.push({
            category: { 
              id: 'uncategorized', 
              name: 'Chưa phân loại',
              description: 'Email chưa được phân loại',
              color: '#gray'
            },
            count: 1
          });
        }
      }

      console.log('Dashboard: Updated email summary, total:', updatedSummary.total);
      return updatedSummary;
    });
  };


  const handleEmailClick = (email: ProcessedEmail) => {
    router.push(createEmailDetailUrl(email.id));
  };

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setShowEmailList(true);
  };

  const handleChatAction = (action: ChatResponse) => {
    switch (action.action) {
      case 'navigate':
        if (action.navigation_url) {
          router.push(action.navigation_url);
        }
        break;

      case 'compose':
        if (action.compose_data) {
          const params = new URLSearchParams();
          if (action.compose_data.to_email) params.set('to', action.compose_data.to_email);
          if (action.compose_data.subject) params.set('subject', action.compose_data.subject);
          router.push(`/email/compose?${params.toString()}`);
        } else {
          router.push('/email/compose');
        }
        break;

      case 'search':
        if (action.search_params) {
          setSearchQuery(action.search_params.query);
          if (action.search_params.category_id) {
            setSelectedCategory(action.search_params.category_id);
          }
          setShowEmailList(true);
        }
        break;

      case 'sync':
        // With automatic sync, we can show a message that sync is always active
        // Or trigger a manual check if needed
        if (!syncStatus.isActive) {
          // If not currently syncing, the EmailList will automatically start sync soon
          // We could show a toast or just acknowledge the request
          console.log('Sync requested - auto-sync is active and will check for new emails');
        }
        break;

      default:
        // 'none' - just show the response
        break;
    }
  };

  const getCategoryEmails = (categoryId: string) => {
    return emailSummary?.categories?.find(c => c.category.id === categoryId);
  };

  const getUncategorizedEmails = () => {
    return emailSummary?.categories?.find(c => c.category.id === 'uncategorized');
  };

  if (showEmailList) {
    return (
      <div className="h-screen flex flex-col bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowEmailList(false)}
                className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                ← Back to Dashboard
              </button>
              <div className="h-6 w-px bg-slate-300"></div>
              <h1 className="text-lg font-semibold text-slate-900">
                {selectedCategory 
                  ? categories.find(c => c.id === selectedCategory)?.name || 'Category'
                  : 'All Emails'
                }
              </h1>
            </div>

            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search emails..."
                  className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-900 w-72"
                />
              </div>
              {/* Sync Status Indicator */}
              <div className="flex items-center space-x-3">
                {syncStatus.isActive ? (
                  <div className="flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    <div className="flex flex-col">
                      <span className="text-sm text-blue-800 font-medium">{syncStatus.message}</span>
                      {syncStatus.totalEmails > 0 && (
                        <div className="flex items-center space-x-2">
                          <div className="w-20 bg-blue-200 rounded-full h-1.5">
                            <div 
                              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${syncStatus.progress}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-blue-600">
                            {syncStatus.progress}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Auto-sync Active</span>
                    {lastSync && (
                      <span className="text-xs text-green-500">
                        Last: {lastSync.toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Email List */}
        <div className="flex-1">
          <EmailList
            categoryId={selectedCategory || undefined}
            searchQuery={searchQuery}
            onEmailClick={handleEmailClick}
          />
        </div>

        {/* Chat */}
        <ChatBox context={appContext} onActionReceived={handleChatAction} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-lg">
              <Mail className="w-6 h-6 text-slate-700" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Gmail AI Assistant</h1>
              <p className="text-sm text-slate-500">Intelligent email management</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Auto-sync status indicator */}
            {syncStatus.isActive ? (
              <div className="flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-blue-800">Syncing</span>
                  <span className="text-xs text-blue-600">{syncStatus.message}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
                <CheckCircle2 className="w-4 h-4" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Auto-sync Active</span>
                  {lastSync && (
                    <span className="text-xs text-emerald-600">
                      Last: {lastSync.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={() => router.push('/email/compose')}
              className="inline-flex items-center px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors duration-200"
            >
              <Plus className="w-4 h-4 mr-2" />
              Compose
            </button>

            <button
              onClick={handleManualSync}
              className="inline-flex items-center justify-center w-10 h-10 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors duration-200"
              title="Manual Sync"
            >
              <RefreshCw className={cn(
                "w-5 h-5",
                isAutoSyncing && "animate-spin"
              )} />
            </button>

            <button
              onClick={handleManualRefresh}
              className="inline-flex items-center justify-center w-10 h-10 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors duration-200"
              title="Refresh Data"
            >
              <BarChart3 className="w-5 h-5" />
            </button>

            <button
              onClick={() => router.push('/settings')}
              className="inline-flex items-center justify-center w-10 h-10 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors duration-200"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Total Emails</p>
                <p className="text-3xl font-bold text-slate-900">
                  {formatNumber(emailSummary?.total || 0)}
                </p>
              </div>
              <div className="flex items-center justify-center w-12 h-12 bg-blue-50 rounded-lg">
                <Inbox className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Unread</p>
                <p className="text-3xl font-bold text-slate-900">
                  {formatNumber(emailSummary?.unread || 0)}
                </p>
              </div>
              <div className="flex items-center justify-center w-12 h-12 bg-amber-50 rounded-lg">
                <Mail className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Categories</p>
                <p className="text-3xl font-bold text-slate-900">
                  {categories.length}
                </p>
              </div>
              <div className="flex items-center justify-center w-12 h-12 bg-emerald-50 rounded-lg">
                <Tag className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Last Sync</p>
                <p className="text-lg font-semibold text-slate-900">
                  {lastSync ? lastSync.toLocaleTimeString() : 'Never'}
                </p>
              </div>
              <div className="flex items-center justify-center w-12 h-12 bg-violet-50 rounded-lg">
                <Clock className="w-6 h-6 text-violet-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Categories Grid */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-1">Email Categories</h2>
              <p className="text-sm text-slate-600">AI-powered email classification</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleManualRefresh}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-colors duration-200"
                title="Refresh category statistics"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => router.push('/settings?tab=categories')}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-colors duration-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Category
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Uncategorized emails */}
            {getUncategorizedEmails() && getUncategorizedEmails()!.count > 0 && (
              <div
                onClick={() => handleCategoryClick('uncategorized')}
                className={cn(
                  "bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg hover:border-slate-300 transition-all duration-200 cursor-pointer group",
                  recentlyUpdatedCategories.has('uncategorized') && "ring-2 ring-blue-500 ring-opacity-20 bg-blue-50/30"
                )}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 rounded-full bg-slate-400"></div>
                    <h3 className="font-semibold text-slate-900 group-hover:text-slate-800">Uncategorized</h3>
                  </div>
                  {getUncategorizedEmails()!.unread > 0 && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      {getUncategorizedEmails()!.unread} unread
                    </span>
                  )}
                </div>
                <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                  Emails not yet classified into specific categories
                </p>
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "text-2xl font-bold text-slate-900 transition-all duration-300",
                    recentlyUpdatedCategories.has('uncategorized') && "text-blue-600"
                  )}>
                    {getUncategorizedEmails()!.count}
                    {recentlyUpdatedCategories.has('uncategorized') && (
                      <span className="inline-block ml-1 text-blue-500 animate-bounce text-sm">↗</span>
                    )}
                  </span>
                  <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                    View All
                  </span>
                </div>
              </div>
            )}

            {/* Category cards */}
            {categories.map((category) => {
              const categoryEmails = getCategoryEmails(category.id);
              const isRecentlyUpdated = recentlyUpdatedCategories.has(category.id);
              return (
                <div
                  key={category.id}
                  onClick={() => handleCategoryClick(category.id)}
                  className={cn(
                    "bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg hover:border-slate-300 transition-all duration-200 cursor-pointer group",
                    isRecentlyUpdated && "ring-2 ring-blue-500 ring-opacity-20 bg-blue-50/30"
                  )}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <h3 className="font-semibold text-slate-900 group-hover:text-slate-800">{category.name}</h3>
                    </div>
                    {categoryEmails && categoryEmails.unread > 0 && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        {categoryEmails.unread} unread
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 text-sm mb-4 leading-relaxed line-clamp-2">
                    {category.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-2xl font-bold text-slate-900 transition-all duration-300",
                      isRecentlyUpdated && "text-blue-600"
                    )}>
                      {categoryEmails?.count || 0}
                      {isRecentlyUpdated && (
                        <span className="inline-block ml-1 text-blue-500 animate-bounce text-sm">↗</span>
                      )}
                    </span>
                    <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                      View All
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Empty state */}
            {categories.length === 0 && (
              <div className="col-span-full">
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                  <div className="flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mx-auto mb-4">
                    <Tag className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    No categories yet
                  </h3>
                  <p className="text-slate-600 mb-6 max-w-md mx-auto">
                    Create categories to automatically organize your emails with AI-powered classification
                  </p>
                  <button
                    onClick={() => router.push('/settings?tab=categories')}
                    className="inline-flex items-center px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors duration-200"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Category
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Analytics & Charts Section */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-1">Email Analytics</h2>
              <p className="text-sm text-slate-600">Insights and statistics about your email activity</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Email Distribution Chart */}
            {emailSummary && (
              <EmailDistributionChart
                categories={emailSummary.categories}
                totalEmails={emailSummary.total}
              />
            )}

            {/* Email Activity Chart */}
            <EmailActivityChart emails={allEmails} />
          </div>

          <div className="grid grid-cols-1">
            {/* Top Senders Chart */}
            <TopSendersChart emails={allEmails} />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            onClick={() => router.push('/email/compose')}
            className="bg-white border border-slate-200 rounded-xl p-8 hover:shadow-lg hover:border-slate-300 transition-all duration-200 group text-center"
          >
            <div className="flex items-center justify-center w-14 h-14 bg-blue-50 rounded-xl mx-auto mb-4 group-hover:bg-blue-100 transition-colors duration-200">
              <Send className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2 group-hover:text-slate-800">Compose Email</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Create new emails with AI assistance
            </p>
          </button>

          <button
            onClick={() => setShowEmailList(true)}
            className="bg-white border border-slate-200 rounded-xl p-8 hover:shadow-lg hover:border-slate-300 transition-all duration-200 group text-center"
          >
            <div className="flex items-center justify-center w-14 h-14 bg-emerald-50 rounded-xl mx-auto mb-4 group-hover:bg-emerald-100 transition-colors duration-200">
              <Inbox className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2 group-hover:text-slate-800">View All Emails</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Browse your complete inbox
            </p>
          </button>

          <button
            onClick={() => router.push('/settings')}
            className="bg-white border border-slate-200 rounded-xl p-8 hover:shadow-lg hover:border-slate-300 transition-all duration-200 group text-center"
          >
            <div className="flex items-center justify-center w-14 h-14 bg-violet-50 rounded-xl mx-auto mb-4 group-hover:bg-violet-100 transition-colors duration-200">
              <Settings className="w-7 h-7 text-violet-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2 group-hover:text-slate-800">Settings</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Manage account and system preferences
            </p>
          </button>
        </div>
      </main>

      {/* Chat Assistant */}
      <ChatBox context={appContext} onActionReceived={handleChatAction} />
    </div>
  );
}