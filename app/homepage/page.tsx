'use client';

import { Mail, Bot, Sparkles, Zap, Search, FileText, ArrowRight, CheckCircle, Shield, Clock } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function HomePage() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Gmail AI Assistant
            </span>
          </div>
          <Link
            href="/"
            className="px-6 py-2.5 bg-white text-blue-600 rounded-xl font-semibold shadow-md hover:shadow-xl transition-all duration-300 border border-blue-100 hover:scale-105"
          >
            Đăng nhập
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 container mx-auto px-6 pt-20 pb-32">
        <div className="max-w-6xl mx-auto">
          <div className={`text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            {/* Badge */}
            <div className="inline-flex items-center space-x-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full mb-8 animate-bounce-slow">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-semibold">Powered by AI Technology</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Quản lý Email
              </span>
              <br />
              <span className="text-gray-800">
                Thông minh hơn với AI
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
              Trợ lý AI thông minh giúp bạn tìm kiếm, soạn thảo và quản lý email Gmail một cách nhanh chóng và hiệu quả
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link
                href="/"
                className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center space-x-2 hover:scale-105 transform"
              >
                <span>Bắt đầu ngay</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button className="px-8 py-4 bg-white text-gray-700 rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 hover:scale-105 transform">
                Xem Demo
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                { icon: Zap, label: '10x nhanh hơn', desc: 'Xử lý email' },
                { icon: Bot, label: '99% chính xác', desc: 'Phân loại tự động' },
                { icon: Clock, label: 'Tiết kiệm 5h/tuần', desc: 'Thời gian làm việc' }
              ].map((stat, index) => (
                <div
                  key={index}
                  className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                  style={{ animationDelay: `${index * 200}ms` }}
                >
                  <stat.icon className="w-8 h-8 text-blue-600 mx-auto mb-3" />
                  <div className="text-2xl font-bold text-gray-800 mb-1">{stat.label}</div>
                  <div className="text-sm text-gray-600">{stat.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 bg-white/50 backdrop-blur-sm py-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
              Tính năng nổi bật
            </h2>
            <p className="text-xl text-gray-600">
              Mọi thứ bạn cần để quản lý email hiệu quả
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                icon: Search,
                title: 'Tìm kiếm thông minh',
                desc: 'Tìm email nhanh chóng với AI hiểu ngữ cảnh tự nhiên',
                color: 'from-blue-500 to-cyan-500'
              },
              {
                icon: FileText,
                title: 'Soạn thảo tự động',
                desc: 'AI giúp viết email chuyên nghiệp trong vài giây',
                color: 'from-purple-500 to-pink-500'
              },
              {
                icon: Bot,
                title: 'Phân loại tự động',
                desc: 'Tự động sắp xếp email theo chủ đề và độ ưu tiên',
                color: 'from-green-500 to-emerald-500'
              },
              {
                icon: Sparkles,
                title: 'Tóm tắt nội dung',
                desc: 'Nắm bắt nội dung email dài trong tích tắc',
                color: 'from-orange-500 to-red-500'
              },
              {
                icon: Shield,
                title: 'Bảo mật cao',
                desc: 'Dữ liệu được mã hóa và bảo vệ tuyệt đối',
                color: 'from-indigo-500 to-purple-500'
              },
              {
                icon: Zap,
                title: 'Xử lý nhanh',
                desc: 'Phản hồi tức thì với công nghệ AI tiên tiến',
                color: 'from-yellow-500 to-orange-500'
              }
            ].map((feature, index) => (
              <div
                key={index}
                className="group bg-white p-8 rounded-2xl shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
              >
                <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 py-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
              Cách hoạt động
            </h2>
            <p className="text-xl text-gray-600">
              Chỉ 3 bước đơn giản để bắt đầu
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  step: '01',
                  title: 'Kết nối Gmail',
                  desc: 'Đăng nhập và cấp quyền truy cập Gmail của bạn một cách an toàn'
                },
                {
                  step: '02',
                  title: 'Nói với AI',
                  desc: 'Hỏi AI bất cứ điều gì về email của bạn bằng ngôn ngữ tự nhiên'
                },
                {
                  step: '03',
                  title: 'Nhận kết quả',
                  desc: 'AI xử lý và đưa ra kết quả chính xác trong tích tắc'
                }
              ].map((step, index) => (
                <div key={index} className="relative">
                  <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
                    <div className="text-6xl font-bold text-blue-100 mb-4">{step.step}</div>
                    <h3 className="text-xl font-bold text-gray-800 mb-3">{step.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{step.desc}</p>
                  </div>
                  {index < 2 && (
                    <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                      <ArrowRight className="w-8 h-8 text-blue-300" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-24">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-12 md:p-16 text-center text-white">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Sẵn sàng trải nghiệm?
              </h2>
              <p className="text-xl mb-8 opacity-90">
                Tham gia cùng hàng nghìn người dùng đã tối ưu hóa cách quản lý email
              </p>
              <Link
                href="/"
                className="inline-flex items-center space-x-2 px-8 py-4 bg-white text-blue-600 rounded-2xl font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 transform"
              >
                <span>Bắt đầu miễn phí</span>
                <ArrowRight className="w-5 h-5" />
              </Link>

              <div className="flex items-center justify-center space-x-8 mt-12">
                {[
                  'Miễn phí 100%',
                  'Không cần thẻ tín dụng',
                  'Bảo mật tuyệt đối'
                ].map((item, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm opacity-90">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 bg-gray-900 text-white py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">Gmail AI Assistant</span>
            </div>
            <div className="text-gray-400 text-sm">
              © 2025 Gmail AI Assistant. All rights reserved.
            </div>
          </div>
        </div>
      </footer>

      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }

        .animate-bounce-slow {
          animation: bounce 3s infinite;
        }
      `}</style>
    </div>
  );
}
