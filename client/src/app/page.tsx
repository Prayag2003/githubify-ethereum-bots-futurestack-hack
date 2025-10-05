"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Code2, Eye, ArrowRight, X, Star, GitBranch, Sparkles } from 'lucide-react';
import { useGitHubUrl } from "@/hooks/useGitHubUrl";
import { useNavigation } from "@/hooks/useNavigation";
import { useRepository } from "@/hooks/useRepository";
import { LocalStorageService } from "@/services/localStorageService";

export default function EnhancedLanding() {
  const { url, setUrl, isValid, getNormalizedUrl } = useGitHubUrl();
  const { navigateToChat, navigateToVisualize } = useNavigation();
  const { cloneAndIngest, isLoading, error, clearError } = useRepository();
  const [isFocused, setIsFocused] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number; duration: number; delay: number }>>([]);
  const [errorMsg, setError] = useState(null)
  const [currentCompany, setCurrentCompany] = useState(0);
  const [actionType, setActionType] = useState<'chat' | 'explore' | 'visualize' | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const companies = [
    // { text: "Ship faster with AI - Vercel", img: null },
    { text: "Powered by LLaMA", img: '/assets/llama.png' },
    { text: "Powered by Cerebras", img: '/assets/cerebras.png' },
    { text: "Containerized with Docker", img: '/assets/docker.png' }
  ];

  const features = [
    {
      id: 'chat',
      icon: Code2,
      title: 'Chat with Code',
      description: 'Ask questions about any file or function',
      color: 'from-purple-500 to-pink-500',
      action: 'chat'
    },
    {
      id: 'explore',
      icon: GitBranch,
      title: 'Explore Tree',
      description: 'Navigate through your codebase structure',
      color: 'from-blue-500 to-cyan-500',
      action: 'explore'
    },
    {
      id: 'visualize',
      icon: Eye,
      title: 'Visualize Architecture',
      description: 'See your code architecture at a glance',
      color: 'from-emerald-500 to-teal-500',
      action: 'visualize'
    }
  ];

  useEffect(() => {
    const newParticles = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2.5 + 0.5,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * 5
    }));
    setParticles(newParticles);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentCompany((prev) => (prev + 1) % companies.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [companies.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const points: any[] = [];
    for (let i = 0; i < 60; i++) {
      points.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5
      });
    }

    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      points.forEach(point => {
        point.x += point.vx;
        point.y += point.vy;

        if (point.x < 0 || point.x > canvas.width) point.vx *= -1;
        if (point.y < 0 || point.y > canvas.height) point.vy *= -1;
      });

      points.forEach((point, i) => {
        points.slice(i + 1).forEach(otherPoint => {
          const dx = point.x - otherPoint.x;
          const dy = point.y - otherPoint.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            ctx.strokeStyle = `rgba(168, 85, 247, ${0.2 * (1 - distance / 150)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
            ctx.lineTo(otherPoint.x, otherPoint.y);
            ctx.stroke();
          }
        });
      });

      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => cancelAnimationFrame(animationId);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100
    });
  };

  type ActionType = 'chat' | 'explore' | 'visualize';
  const handleAction = async (action: ActionType) => {
    if (!isValid || isLoading) return;

    setActionType(action);
    clearError();

    try {
      const normalizedUrl = getNormalizedUrl();
      const result = await cloneAndIngest(normalizedUrl);

      if (result.success && result.data.repo_id) {
        LocalStorageService.setRepositoryData({
          repo_id: result.data.repo_id,
          github_url: normalizedUrl,
          files_processed: result.data.files_processed,
          index_name: result.data.index_name
        });

        setTimeout(() => {
          if (action === 'chat') {
            navigateToChat(result.data.repo_id);
          } else {
            // unified visualizer URL
            window.location.href = `/visualize?repo=${result.data.repo_id}`;
          }
        }, 100);
      }
    } catch (error) {
      console.error('Network error during repository cloning:', error);
    } finally {
      setActionType(null);
    }
  };


  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white overflow-x-hidden flex flex-col" onMouseMove={handleMouseMove}>
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none opacity-40" />

      {/* Enhanced animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-[900px] h-[900px] rounded-full opacity-35 blur-3xl transition-all duration-300 ease-out"
          style={{
            background: 'radial-gradient(circle, rgba(168,85,247,0.7) 0%, rgba(236,72,153,0.5) 30%, rgba(59,130,246,0.3) 50%, rgba(0,0,0,0) 70%)',
            left: `${mousePosition.x}%`,
            top: `${mousePosition.y}%`,
            transform: 'translate(-50%, -50%)'
          }}
        />
        <div className="absolute -top-48 -left-48 w-[500px] h-[500px] bg-purple-500/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-48 -right-48 w-[500px] h-[500px] bg-pink-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }} />

        {particles.map(particle => (
          <div
            key={particle.id}
            className="absolute rounded-full bg-gradient-to-r from-purple-400/40 to-pink-400/40"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              animation: `float ${particle.duration}s ease-in-out infinite`,
              animationDelay: `${particle.delay}s`
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-12 py-6 border-b border-white/5 backdrop-blur-sm">
        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-6">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </div>
          <span className="text-xl font-semibold tracking-tight">Githubify AI</span>
        </div>

        <a
          href="https://github.com/Prayag2003/githubify-ethereum-bots-futurestack-hack"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all duration-300 border border-white/10 hover:border-white/20 hover:scale-105 group"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white transition-transform duration-300 group-hover:rotate-12">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <span className="text-sm font-medium">Github</span>
          <div className="flex items-center gap-1 px-2 py-0.5 bg-white/10 rounded-md transition-colors duration-300 group-hover:bg-white/15">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-semibold">198</span>
          </div>
        </a>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-16">
        <div className="text-center max-w-4xl mx-auto w-full space-y-10">

          {/* Hero Section */}
          <div className="space-y-8 animate-fade-in">
            <h1 className="text-6xl md:text-7xl lg:text-7xl font-black tracking-tight leading-[1.05]">
              <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 bg-clip-text text-transparent animate-gradient block mb-3">
                Don't just be a Vibe Coder
              </span>
              <span className="text-4xl md:text-5xl lg:text-5xl bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent animate-gradient block">
                Understand Your Codebase Better
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto font-light animate-slide-up" style={{ animationDelay: '0.2s' }}>
              Ask questions, visualize architecture, and explore your code like never before
            </p>

            {/* Rotating Sponsors */}
            <div className="h-6 overflow-hidden animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <div className="transition-transform duration-500 ease-in-out" style={{ transform: `translateY(-${currentCompany * 24}px)` }}>
                {companies.map((company, index) => (
                  <div key={index} className="h-6 flex items-center justify-center gap-2">
                    {company.img && (
                      <img src={company.img} alt="logo" className="h-5 w-auto object-contain" />
                    )}
                    <p className="text-sm text-gray-400 font-light italic">
                      {company.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Input Section */}
          <div className="max-w-2xl mx-auto space-y-4 animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <div className="relative group">
              <div className={`absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 rounded-2xl opacity-0 blur-lg transition-all duration-500 ${isFocused || isValid ? 'opacity-75 group-hover:opacity-100' : ''}`} />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="github.com/owner/repository"
                className={`relative w-full px-6 py-4 bg-gray-900/90 backdrop-blur-xl border-2 rounded-xl text-white placeholder-gray-500 focus:outline-none transition-all duration-300 text-base ${isFocused || isValid ? 'border-purple-500/50 shadow-lg shadow-purple-500/20' : 'border-white/10'
                  }`}
              />
              {isValid && !isLoading && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 animate-scale-in">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-sm text-emerald-400 font-medium">Valid</span>
                </div>
              )}
            </div>

            {/* Error State */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl animate-scale-in backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-red-300 text-sm">{error}</p>
                  </div>
                  <button onClick={() => setError(null)} className="hover:scale-110 transition-transform">
                    <X className="w-5 h-5 text-red-400" />
                  </button>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl backdrop-blur-sm animate-scale-in">
                <div className="flex items-center gap-3 mb-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-400 border-t-transparent" />
                  <p className="font-medium text-sm text-purple-300">Processing Repository...</p>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full animate-progress-bar" />
                </div>
              </div>
            )}
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {features.map((feature, index) => (
              <button
                key={feature.id}
                disabled={!isValid || isLoading}
                onClick={() => handleAction(feature.action as 'chat' | 'explore' | 'visualize')}
                onMouseEnter={() => setHoveredCard(index)}
                onMouseLeave={() => setHoveredCard(null)}
                className={`relative overflow-hidden bg-white/5 backdrop-blur-sm border rounded-xl p-6 transition-all duration-300 text-left animate-slide-up ${isValid && !isLoading
                  ? 'hover:bg-white/10 hover:border-white/20 cursor-pointer border-white/10 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/20'
                  : 'opacity-40 cursor-not-allowed border-white/5'
                  }`}
                style={{ animationDelay: `${0.6 + index * 0.1}s` }}
              >
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 transition-all duration-300 ${hoveredCard === index && !isLoading ? 'scale-110 rotate-6' : 'scale-100'
                  }`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>

                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-400 mb-4">{feature.description}</p>

                <div className={`flex items-center gap-2 text-sm font-medium transition-all duration-300 ${isValid && !isLoading ? 'text-purple-400' : 'text-gray-600'
                  }`}>
                  <span>Get started</span>
                  <ArrowRight className={`w-4 h-4 transition-transform duration-300 ${hoveredCard === index && !isLoading ? 'translate-x-2' : 'translate-x-0'
                    }`} />
                </div>

                {/* Shimmer effect on hover */}
                {hoveredCard === index && !isLoading && (
                  <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                )}
              </button>
            ))}
          </div>

          {/* Footer Credits */}
          {/* <div className="pt-8 flex items-center justify-center gap-6 text-sm text-gray-500 animate-fade-in" style={{ animationDelay: '0.8s' }}>
            <span className="hover:text-gray-400 transition-colors cursor-default">Powered by LLaMA</span>
            <span className="w-1 h-1 bg-gray-600 rounded-full" />
            <span className="hover:text-gray-400 transition-colors cursor-default">Cerebras</span>
            <span className="w-1 h-1 bg-gray-600 rounded-full" />
            <span className="hover:text-gray-400 transition-colors cursor-default">Docker</span>
          </div> */}
        </div>
      </main>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-25px) translateX(15px); }
          50% { transform: translateY(-15px) translateX(-15px); }
          75% { transform: translateY(-20px) translateX(10px); }
        }

        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        .animate-gradient {
          background-size: 200% auto;
          animation: gradient 6s ease infinite;
        }

        @keyframes progress-bar {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        
        .animate-progress-bar {
          animation: progress-bar 45s linear forwards;
        }

        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .animate-fade-in {
          animation: fade-in 1s ease-out forwards;
          opacity: 0;
        }

        @keyframes slide-up {
          from { 
            opacity: 0; 
            transform: translateY(30px);
          }
          to { 
            opacity: 1; 
            transform: translateY(0);
          }
        }
        
        .animate-slide-up {
          animation: slide-up 0.8s ease-out forwards;
          opacity: 0;
        }

        @keyframes scale-in {
          from { 
            opacity: 0; 
            transform: scale(0.9);
          }
          to { 
            opacity: 1; 
            transform: scale(1);
          }
        }
        
        .animate-scale-in {
          animation: scale-in 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        .animate-shimmer {
          animation: shimmer 1.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}