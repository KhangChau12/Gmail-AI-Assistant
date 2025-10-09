'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowLeft,
  Mail,
  Tag,
  Users,
  Settings as SettingsIcon,
  TestTube,
  Save,
  Trash2,
  Plus,
  Edit,
  Check,
  X,
  RefreshCw,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { Category, Contact } from '@/types';
import { cn, generateCategoryColor, isValidEmail } from '@/lib/utils';

type TabType = 'gmail' | 'categories' | 'contacts' | 'sync';

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabType) || 'gmail';
  
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [categories, setCategories] = useState<Category[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{imap: boolean; smtp: boolean} | null>(null);
  
  // Gmail settings
  const [gmailAddress, setGmailAddress] = useState('');
  const [gmailPassword, setGmailPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Category form
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    color: generateCategoryColor()
  });
  
  // Contact form
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    aliases: [''],
    category: '',
    notes: ''
  });
  
  // Inline editing states
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editingContactData, setEditingContactData] = useState<{
    name: string;
    category: string;
    notes: string;
  }>({ name: '', category: '', notes: '' });

  useEffect(() => {
    loadData();
    loadGmailSettings();
  }, []);

  const loadData = async () => {
    await Promise.all([
      fetchCategories(),
      fetchContacts()
    ]);
  };

  const loadGmailSettings = () => {
    // Load from environment variables (for display only)
    setGmailAddress(process.env.NEXT_PUBLIC_GMAIL_ADDRESS || '');
    // Don't load password for security
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

  const fetchContacts = async () => {
    try {
      const response = await fetch('/api/db?resource=contacts');
      if (response.ok) {
        const data = await response.json();
        setContacts(data);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const testGmailConnection = async () => {
    setTesting(true);
    try {
      const response = await fetch('/api/gmail?action=test');
      if (response.ok) {
        const result = await response.json();
        setConnectionStatus(result);
        
        if (result.imap && result.smtp) {
          alert('Kết nối Gmail thành công!');
        } else {
          alert('Kết nối thất bại. Vui lòng kiểm tra thông tin đăng nhập.');
        }
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      alert('Không thể kiểm tra kết nối. Vui lòng thử lại.');
    } finally {
      setTesting(false);
    }
  };

  const handleCategorySubmit = async () => {
    if (!categoryForm.name.trim() || !categoryForm.description.trim()) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }

    try {
      setLoading(true);
      
      const categoryData = {
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim(),
        color: categoryForm.color
      };

      let response;
      if (editingCategory) {
        response = await fetch('/api/db?resource=categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingCategory.id, ...categoryData })
        });
      } else {
        response = await fetch('/api/db?resource=categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(categoryData)
        });
      }

      if (response.ok) {
        await fetchCategories();
        setShowCategoryForm(false);
        setEditingCategory(null);
        setCategoryForm({
          name: '',
          description: '',
          color: generateCategoryColor()
        });
      }
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Không thể lưu danh mục. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryDelete = async (categoryId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa danh mục này?')) return;

    try {
      const response = await fetch(`/api/db?resource=categories&id=${categoryId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchCategories();
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Không thể xóa danh mục. Vui lòng thử lại.');
    }
  };

  const handleContactSubmit = async () => {
    if (!contactForm.name.trim() || !contactForm.email.trim() || !isValidEmail(contactForm.email)) {
      alert('Vui lòng điền đầy đủ thông tin hợp lệ');
      return;
    }

    try {
      setLoading(true);
      
      const contactData = {
        name: contactForm.name.trim(),
        email: contactForm.email.trim(),
        aliases: contactForm.aliases.filter(alias => alias.trim()).map(alias => alias.trim()),
        category: contactForm.category.trim(),
        notes: contactForm.notes.trim(),
        extracted_from_email: false
      };

      const response = await fetch('/api/db?resource=contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactData)
      });

      if (response.ok) {
        await fetchContacts();
        setShowContactForm(false);
        setContactForm({
          name: '',
          email: '',
          aliases: [''],
          category: '',
          notes: ''
        });
      }
    } catch (error) {
      console.error('Error saving contact:', error);
      alert('Không thể lưu danh bạ. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Inline contact editing functions
  const startEditingContact = (contact: Contact) => {
    setEditingContactId(contact.id);
    setEditingContactData({
      name: contact.name,
      category: contact.category || '',
      notes: contact.notes || ''
    });
  };

  const cancelEditingContact = () => {
    setEditingContactId(null);
    setEditingContactData({ name: '', category: '', notes: '' });
  };

  const saveContactEdit = async (contactId: string) => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/db?resource=contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: contactId, 
          ...editingContactData 
        })
      });

      if (response.ok) {
        await fetchContacts();
        setEditingContactId(null);
        setEditingContactData({ name: '', category: '', notes: '' });
      } else {
        alert('Không thể cập nhật liên hệ. Vui lòng thử lại.');
      }
    } catch (error) {
      console.error('Error updating contact:', error);
      alert('Lỗi khi cập nhật liên hệ. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'gmail', name: 'Gmail Setup', icon: Mail },
    { id: 'categories', name: 'Danh mục', icon: Tag },
    { id: 'contacts', name: 'Danh bạ', icon: Users },
    { id: 'sync', name: 'Đồng bộ', icon: RefreshCw }
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/')}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Cài đặt</h1>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-64">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'w-full flex items-center space-x-3 px-4 py-3 text-left rounded-lg transition-colors',
                      activeTab === tab.id
                        ? 'bg-primary-50 text-primary-700 border border-primary-200'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1">
            {activeTab === 'gmail' && (
              <div className="card">
                <div className="card-header">
                  <h2 className="text-xl font-semibold text-gray-900">Cài đặt Gmail</h2>
                  <p className="text-gray-600 mt-1">
                    Cấu hình kết nối Gmail qua IMAP và SMTP
                  </p>
                </div>
                <div className="card-body space-y-6">
                  {/* Connection Status */}
                  {connectionStatus && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-3">Trạng thái kết nối:</h3>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <div className={cn(
                            'w-3 h-3 rounded-full',
                            connectionStatus.imap ? 'bg-green-500' : 'bg-red-500'
                          )} />
                          <span className="text-sm">
                            IMAP: {connectionStatus.imap ? 'Kết nối thành công' : 'Kết nối thất bại'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className={cn(
                            'w-3 h-3 rounded-full',
                            connectionStatus.smtp ? 'bg-green-500' : 'bg-red-500'
                          )} />
                          <span className="text-sm">
                            SMTP: {connectionStatus.smtp ? 'Kết nối thành công' : 'Kết nối thất bại'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Gmail Address */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Địa chỉ Gmail
                    </label>
                    <input
                      type="email"
                      value={gmailAddress}
                      onChange={(e) => setGmailAddress(e.target.value)}
                      placeholder="example@gmail.com"
                      className="input-field"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Địa chỉ Gmail của bạn
                    </p>
                  </div>

                  {/* App Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      App Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={gmailPassword}
                        onChange={(e) => setGmailPassword(e.target.value)}
                        placeholder="16 ký tự App Password"
                        className="input-field pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Tạo App Password tại: Google Account → Security → 2-Step Verification → App passwords
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-3">
                    <button
                      onClick={testGmailConnection}
                      disabled={testing}
                      className="btn-secondary"
                    >
                      {testing ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <TestTube className="w-4 h-4" />
                      )}
                      Kiểm tra kết nối
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'categories' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Quản lý danh mục</h2>
                    <p className="text-gray-600 mt-1">
                      Tạo và quản lý danh mục để phân loại email tự động
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCategoryForm(true)}
                    className="btn-primary"
                  >
                    <Plus className="w-4 h-4" />
                    Thêm danh mục
                  </button>
                </div>

                {/* Category Form */}
                {showCategoryForm && (
                  <div className="card">
                    <div className="card-header">
                      <h3 className="font-semibold text-gray-900">
                        {editingCategory ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}
                      </h3>
                    </div>
                    <div className="card-body space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Tên danh mục
                        </label>
                        <input
                          type="text"
                          value={categoryForm.name}
                          onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Ví dụ: Dịch vụ đang sử dụng"
                          className="input-field"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Mô tả chi tiết
                        </label>
                        <textarea
                          value={categoryForm.description}
                          onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Mô tả chi tiết giúp AI phân loại chính xác hơn..."
                          rows={3}
                          className="input-field resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Màu sắc
                        </label>
                        <input
                          type="color"
                          value={categoryForm.color}
                          onChange={(e) => setCategoryForm(prev => ({ ...prev, color: e.target.value }))}
                          className="w-16 h-10 border border-gray-300 rounded cursor-pointer"
                        />
                      </div>

                      <div className="flex space-x-3">
                        <button
                          onClick={handleCategorySubmit}
                          disabled={loading}
                          className="btn-primary"
                        >
                          <Save className="w-4 h-4" />
                          {loading ? 'Đang lưu...' : 'Lưu'}
                        </button>
                        <button
                          onClick={() => {
                            setShowCategoryForm(false);
                            setEditingCategory(null);
                            setCategoryForm({
                              name: '',
                              description: '',
                              color: generateCategoryColor()
                            });
                          }}
                          className="btn-secondary"
                        >
                          <X className="w-4 h-4" />
                          Hủy
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Categories List */}
                <div className="space-y-3">
                  {categories.map((category) => (
                    <div key={category.id} className="card">
                      <div className="card-body">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <div 
                              className="w-4 h-4 rounded-full mt-1"
                              style={{ backgroundColor: category.color }}
                            />
                            <div>
                              <h3 className="font-semibold text-gray-900">{category.name}</h3>
                              <p className="text-gray-600 text-sm mt-1">{category.description}</p>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                setEditingCategory(category);
                                setCategoryForm({
                                  name: category.name,
                                  description: category.description,
                                  color: category.color
                                });
                                setShowCategoryForm(true);
                              }}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleCategoryDelete(category.id)}
                              className="text-gray-400 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {categories.length === 0 && (
                    <div className="text-center py-12">
                      <Tag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Chưa có danh mục nào
                      </h3>
                      <p className="text-gray-600">
                        Tạo danh mục đầu tiên để bắt đầu phân loại email
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'contacts' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Quản lý danh bạ</h2>
                    <p className="text-gray-600 mt-1">
                      Quản lý danh bạ để chat AI hiểu và tìm liên hệ dễ dàng
                    </p>
                  </div>
                  <button
                    onClick={() => setShowContactForm(true)}
                    className="btn-primary"
                  >
                    <Plus className="w-4 h-4" />
                    Thêm liên hệ
                  </button>
                </div>

                {/* Contact Form */}
                {showContactForm && (
                  <div className="card">
                    <div className="card-header">
                      <h3 className="font-semibold text-gray-900">Thêm liên hệ mới</h3>
                    </div>
                    <div className="card-body space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Tên hiển thị
                          </label>
                          <input
                            type="text"
                            value={contactForm.name}
                            onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Anh Nam Nguyễn"
                            className="input-field"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email
                          </label>
                          <input
                            type="email"
                            value={contactForm.email}
                            onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="nam@example.com"
                            className="input-field"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Biệt danh (mỗi dòng một biệt danh)
                        </label>
                        <textarea
                          value={contactForm.aliases.join('\n')}
                          onChange={(e) => setContactForm(prev => ({ 
                            ...prev, 
                            aliases: e.target.value.split('\n').filter(Boolean) 
                          }))}
                          placeholder="Nam&#10;Anh Nam&#10;Nam Nguyễn"
                          rows={3}
                          className="input-field resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Danh mục
                          </label>
                          <input
                            type="text"
                            value={contactForm.category}
                            onChange={(e) => setContactForm(prev => ({ ...prev, category: e.target.value }))}
                            placeholder="Công việc, Gia đình..."
                            className="input-field"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Ghi chú
                          </label>
                          <input
                            type="text"
                            value={contactForm.notes}
                            onChange={(e) => setContactForm(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Ghi chú bổ sung..."
                            className="input-field"
                          />
                        </div>
                      </div>

                      <div className="flex space-x-3">
                        <button
                          onClick={handleContactSubmit}
                          disabled={loading}
                          className="btn-primary"
                        >
                          <Save className="w-4 h-4" />
                          {loading ? 'Đang lưu...' : 'Lưu'}
                        </button>
                        <button
                          onClick={() => {
                            setShowContactForm(false);
                            setContactForm({
                              name: '',
                              email: '',
                              aliases: [''],
                              category: '',
                              notes: ''
                            });
                          }}
                          className="btn-secondary"
                        >
                          <X className="w-4 h-4" />
                          Hủy
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Contacts List */}
                <div className="space-y-3">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="card">
                      <div className="card-body">
                        {editingContactId === contact.id ? (
                          /* Editing Mode */
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-medium text-gray-700">Chỉnh sửa liên hệ</h3>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => saveContactEdit(contact.id)}
                                  disabled={loading}
                                  className="text-green-600 hover:text-green-800 p-1 rounded transition-colors"
                                  title="Lưu thay đổi"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={cancelEditingContact}
                                  className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
                                  title="Hủy chỉnh sửa"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Tên hiển thị
                                </label>
                                <input
                                  type="text"
                                  value={editingContactData.name}
                                  onChange={(e) => setEditingContactData(prev => ({ 
                                    ...prev, 
                                    name: e.target.value 
                                  }))}
                                  className="input-field text-sm"
                                  placeholder="Tên liên hệ"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Danh mục
                                </label>
                                <input
                                  type="text"
                                  value={editingContactData.category}
                                  onChange={(e) => setEditingContactData(prev => ({ 
                                    ...prev, 
                                    category: e.target.value 
                                  }))}
                                  className="input-field text-sm"
                                  placeholder="Công việc, Gia đình..."
                                />
                              </div>
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Ghi chú
                              </label>
                              <input
                                type="text"
                                value={editingContactData.notes}
                                onChange={(e) => setEditingContactData(prev => ({ 
                                  ...prev, 
                                  notes: e.target.value 
                                }))}
                                className="input-field text-sm"
                                placeholder="Ghi chú bổ sung..."
                              />
                            </div>
                            
                            <div className="pt-2 border-t border-gray-100">
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>Email: {contact.email}</span>
                                {contact.aliases.length > 0 && (
                                  <span>Biệt danh: {contact.aliases.join(', ')}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* View Mode */
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-gray-900">{contact.name}</h3>
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => startEditingContact(contact)}
                                    className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
                                    title="Chỉnh sửa liên hệ"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  {contact.extracted_from_email && (
                                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                                      Tự động
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <p className="text-gray-600 text-sm mt-1">{contact.email}</p>
                              
                              {contact.aliases.length > 0 && (
                                <p className="text-gray-500 text-xs mt-1">
                                  Biệt danh: {contact.aliases.join(', ')}
                                </p>
                              )}
                              
                              <div className="mt-2 flex flex-wrap gap-2">
                                {contact.category && (
                                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                                    📁 {contact.category}
                                  </span>
                                )}
                                {contact.notes && (
                                  <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                    📝 {contact.notes}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {contacts.length === 0 && (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Chưa có liên hệ nào
                      </h3>
                      <p className="text-gray-600">
                        Thêm liên hệ để AI assistant có thể hiểu và tìm kiếm dễ dàng
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'sync' && (
              <div className="card">
                <div className="card-header">
                  <h2 className="text-xl font-semibold text-gray-900">Cài đặt đồng bộ</h2>
                  <p className="text-gray-600 mt-1">
                    Quản lý cách thức đồng bộ email từ Gmail
                  </p>
                </div>
                <div className="card-body space-y-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <RefreshCw className="w-5 h-5 text-green-400" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-green-800">
                          Đồng bộ tự động
                        </h3>
                        <div className="mt-2 text-sm text-green-700">
                          <p>
                            Hệ thống đồng bộ tự động chạy liên tục trong nền, 
                            kiểm tra email mới mỗi 5 phút và xử lý real-time qua Server-Sent Events.
                            Không cần thao tác thủ công.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Thông tin đồng bộ</h3>
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Thư mục đồng bộ</dt>
                        <dd className="mt-1 text-sm text-gray-900">INBOX (Hộp thư đến)</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Số email mỗi lần</dt>
                        <dd className="mt-1 text-sm text-gray-900">Không giới hạn</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Tần suất đồng bộ</dt>
                        <dd className="mt-1 text-sm text-gray-900">Tự động mỗi 5 phút + Real-time streaming</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Phạm vi xử lý</dt>
                        <dd className="mt-1 text-sm text-gray-900">Tất cả email (không chỉ email chưa đọc)</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Xử lý AI</dt>
                        <dd className="mt-1 text-sm text-gray-900">Phân loại + Tóm tắt tự động</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Trích xuất danh bạ</dt>
                        <dd className="mt-1 text-sm text-gray-900">Tự động từ email headers</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Chống trùng lặp</dt>
                        <dd className="mt-1 text-sm text-gray-900">Kiểm tra IMAP UID để tránh xử lý trùng</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Hoạt động nền</dt>
                        <dd className="mt-1 text-sm text-gray-900">Chạy liên tục ngay khi không xem trang</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <SettingsIcon className="w-5 h-5 text-blue-400" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-blue-800">
                          Tính năng nâng cao
                        </h3>
                        <div className="mt-2 text-sm text-blue-700">
                          <ul className="list-disc list-inside space-y-1">
                            <li>Tự động kết nối lại khi mất kết nối</li>
                            <li>Timeout protection với retry logic</li>
                            <li>Keep-alive để duy trì kết nối ổn định</li>
                            <li>Streaming real-time với progress tracking</li>
                            <li>Xử lý song song với chunk processing</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}