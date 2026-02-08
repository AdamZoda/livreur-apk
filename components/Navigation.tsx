
import React from 'react';
import { Home, ClipboardList, BarChart3, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const Navigation: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { icon: Home, path: '/', label: 'Radar' },
    { icon: ClipboardList, path: '/mission', label: 'Mission' },
    { icon: BarChart3, path: '/stats', label: 'Stats' },
    { icon: User, path: '/profile', label: 'Profil' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass-dark border-t border-white/10 px-6 py-3 pb-8 z-50 flex justify-between items-center">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center gap-1 transition-colors ${
              isActive ? 'text-orange-500' : 'text-slate-400'
            }`}
          >
            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

export default Navigation;
