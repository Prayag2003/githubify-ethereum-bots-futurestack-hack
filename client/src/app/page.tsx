"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Github, Sparkles, Code2, GitBranch, Eye, ArrowRight, Zap, X } from 'lucide-react';
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
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number; duration: number; delay: number }>>([]);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [currentCompany, setCurrentCompany] = useState(0);
  const [actionType, setActionType] = useState<'chat' | 'explore' | 'visualize' | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const companies = [
    { text: '"Ship faster with AI" - Vercel', img: null },
    { text: '"Powered by LLaMA"', img: '/assets/llama.png' },
    { text: '"Powered by Cerebras"', img: '/assets/cerebras.png' },
    { text: '"Containerized with Docker"', img: '/assets/docker.png' }
  ];

  const features = [
    {
      id: 'chat',
      icon: Code2,
      title: 'Chat with Code',
      description: 'Ask questions about any file or function',
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-gradient-to-br from-purple-500/20 to-pink-500/20',
      action: 'chat'
    },
    // {
    //   id: 'explore',
    //   icon: GitBranch,
    //   title: 'Explore Tree',
    //   description: 'Navigate through your codebase structure',
    //   color: 'from-blue-500 to-cyan-500',
    //   bgColor: 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20',
    //   action: 'explore'
    // },
    {
      id: 'visualize',
      icon: Eye,
      title: 'Visualize Architecture',
      description: 'See your code architecture at a glance',
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-gradient-to-br from-green-500/20 to-emerald-500/20',
      action: 'visualize'
    }
  ];

  useEffect(() => {
    const newParticles = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 25 + 20,
      delay: Math.random() * 5
    }));
    setParticles(newParticles);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentCompany((prev) => (prev + 1) % companies.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const points: any[] = [];
    for (let i = 0; i < 50; i++) {
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
            ctx.strokeStyle = `rgba(147, 51, 234, ${0.15 * (1 - distance / 150)})`;
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

  const handleAction = async (action: 'chat' | 'explore' | 'visualize') => {
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

        // Use setTimeout to ensure navigation happens after state updates
        setTimeout(() => {
          if (action === 'chat') {
            navigateToChat(result.data.repo_id);
          } else if (action === 'visualize') {
            navigateToVisualize(result.data.repo_id);
          } else if (action === 'explore') {
            window.location.href = `/explore?repo_id=${result.data.repo_id}`;
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
    <div className="h-screen w-screen bg-black text-white overflow-hidden relative flex flex-col" onMouseMove={handleMouseMove}>
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none opacity-30" />

      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-20 blur-3xl transition-all duration-700 ease-out"
          style={{
            background: 'radial-gradient(circle, rgba(147,51,234,0.5) 0%, rgba(0,0,0,0) 70%)',
            left: `${mousePosition.x}%`,
            top: `${mousePosition.y}%`,
            transform: 'translate(-50%, -50%)'
          }}
        />
        <div className="absolute -top-48 -left-48 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-48 -right-48 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />

        {particles.map(particle => (
          <div
            key={particle.id}
            className="absolute rounded-full bg-purple-400/30"
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

      <header className="relative z-10 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="w-11 h-11 bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl flex items-center justify-center transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
            <Github className="w-5 h-5" />
          </div>
          <span className="text-lg font-semibold">Codebase AI</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400 animate-pulse">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>Powered by AI</span>
        </div>
      </header>



      <main className="relative z-10 flex-1 flex items-center justify-center px-8 pb-8">
        <div className="text-center max-w-5xl mx-auto w-full">
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-full mb-4 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-300">Elevate your code understanding</span>
            </div>

            {/* Adjusted Headings */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-2 tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-purple-400 via-pink-600 to-purple-700 bg-clip-text text-transparent animate-gradient inline-block">
                Don't just be a Vibe Coder
              </span>
            </h1>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-light mb-1">
              <span className="bg-gradient-to-r from-purple-600 via-purple-400 to-pink-500 bg-clip-text text-transparent animate-gradient">
                Be a Better Developer
              </span>
            </h2>

            <h3 className="text-2xl md:text-3xl lg:text-4xl font-extrabold mb-4 tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-purple-400 via-blue-500 to-cyan-600 bg-clip-text text-transparent animate-gradient inline-block">
                Understand Your Codebases
              </span>
            </h3>

            {/* Subtext and "Powered by" Section */}
            <p className="text-md md:text-lg text-gray-400 font-medium mb-6 animate-slide-in">
              Ask questions, visualize architecture, and explore like never before.
            </p>

            <div className="h-6 mb-6 overflow-hidden">
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

          <div className="max-w-xl mx-auto mb-4">
            <div className="relative group transition-all duration-300">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 rounded-2xl opacity-0 group-hover:opacity-100 blur-lg transition-all duration-500" />
              <div className="relative">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="github.com/owner/repository"
                  className="w-full px-6 py-3 bg-gray-900/80 backdrop-blur-xl border border-white/20 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 text-base"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {isValid && !isLoading && (
                    <div className="flex items-center gap-2 animate-scale-in">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-xs text-green-400 font-medium">Valid</span>
                    </div>
                  )}
                  <Zap className={`w-5 h-5 transition-all duration-300 ${isValid ? 'text-green-400' : 'text-gray-600'}`} />
                </div>
              </div>
            </div>
          </div>

          {/* Error and Loading States */}
          {error && (
            <div className="max-w-xl mx-auto mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-xl animate-scale-in">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5"><span className="text-red-400 text-xs font-bold">!</span></div>
                <div className="flex-1"><p className="text-red-300/80 text-xs">{error}</p></div>
                <button onClick={clearError}><X className="w-4 h-4 text-red-400" /></button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="max-w-xl mx-auto mb-4 p-4 bg-gradient-to-br from-blue-900/40 via-purple-900/40 to-blue-900/40 border border-blue-500/40 rounded-xl animate-scale-in">
              <div className="flex items-center gap-2 mb-2">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-400 border-t-transparent"></div>
                <p className="font-bold text-sm bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent">Processing Repository...</p>
              </div>
              <div className="h-1 bg-blue-900/50 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full animate-progress"></div>
              </div>
            </div>
          )}

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-xl mx-auto">
            {features.map((feature, index) => (
              <button
                key={feature.id}
                disabled={!isValid || isLoading}
                onClick={() => handleAction(feature.action as any)}
                onMouseEnter={() => setHoveredCard(index)}
                onMouseLeave={() => setHoveredCard(null)}
                className={`group relative overflow-hidden ${feature.bgColor} backdrop-blur-sm border-2 rounded-2xl p-4 transition-all duration-500 disabled:opacity-40 disabled:cursor-not-allowed ${isValid && !isLoading ? 'hover:scale-105 hover:shadow-2xl cursor-pointer border-white/20 hover:border-white/40' : 'border-white/10'
                  }`}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-3 transition-all duration-500 ${hoveredCard === index && !isLoading ? 'scale-110' : 'scale-100'}`}>
                  {isLoading && actionType === feature.action ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <feature.icon className="w-5 h-5 text-white" />
                  )}
                </div>
                <h3 className="text-md font-bold text-white mb-1">{feature.title}</h3>
                <p className="text-xs text-gray-300 mb-3">{feature.description}</p>
                <div className={`flex items-center gap-1 text-xs font-medium transition-all duration-300 ${isValid && !isLoading ? 'text-white' : 'text-gray-500'}`}>
                  {isLoading && actionType === feature.action ? 'Processing...' : 'Start now'}
                  <ArrowRight className={`w-3 h-3 transition-transform duration-300 ${hoveredCard === index && !isLoading ? 'translate-x-1' : 'translate-x-0'}`} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-30px) translateX(15px); }
          50% { transform: translateY(-15px) translateX(-15px); }
          75% { transform: translateY(-25px) translateX(10px); }
        }
        
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        .animate-gradient {
          background-size: 200% auto;
          animation: gradient 4s ease infinite;
        }
        
        @keyframes scale-in {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        
        .animate-scale-in {
          animation: scale-in 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1); }
        }
        
        .animate-sparkle {
          animation: sparkle 1s ease-in-out infinite;
        }

        @keyframes slide-in {
          from { 
            opacity: 0; 
            transform: translateX(-20px);
          }
          to { 
            opacity: 1; 
            transform: translateX(0);
          }
        }
        
        .animate-slide-in {
          animation: slide-in 0.5s ease-out forwards;
        }

        @keyframes progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        
        .animate-progress {
          animation: progress 45s linear forwards;
        }
      `}</style>
    </div >
  );
}