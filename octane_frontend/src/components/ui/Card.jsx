import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const Card = ({
  children,
  title,
  subtitle,
  action,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  footer,
  ...props
}) => {
  return (
    <div
      className={`glass-card rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200 ${className}`}
      {...props}
    >
      {(title || subtitle || action) && (
        <div className={`flex items-center justify-between pb-4 mb-4 border-b border-slate-100 ${headerClassName}`}>
          <div>
            {title && <h3 className="text-base font-bold text-slate-800 tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}

      <div className={bodyClassName}>{children}</div>

      {footer && (
        <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
          {footer}
        </div>
      )}
    </div>
  );
};

export const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  trendType = 'neutral', // 'up' | 'down' | 'neutral'
  accentColor = 'orange', // 'orange' | 'amber' | 'emerald' | 'rose' | 'indigo'
  className = '',
}) => {
  const accentStyles = {
    orange: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-600',
      iconBg: 'bg-orange-100 text-orange-600 border-orange-200',
      glow: 'hover:border-slate-300 hover:shadow-md',
    },
    amber: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-600',
      iconBg: 'bg-amber-100 text-amber-600 border-amber-200',
      glow: 'hover:border-slate-300 hover:shadow-md',
    },
    emerald: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-600',
      iconBg: 'bg-emerald-100 text-emerald-600 border-emerald-200',
      glow: 'hover:border-emerald-300 hover:shadow-emerald-500/10',
    },
    rose: {
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      text: 'text-rose-600',
      iconBg: 'bg-rose-100 text-rose-600 border-rose-200',
      glow: 'hover:border-rose-300 hover:shadow-rose-500/10',
    },
    indigo: {
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
      text: 'text-indigo-600',
      iconBg: 'bg-indigo-100 text-indigo-600 border-indigo-200',
      glow: 'hover:border-indigo-300 hover:shadow-indigo-500/10',
    },
  };

  const currentAccent = accentStyles[accentColor] || accentStyles.orange;

  const trendColors = {
    up: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    down: 'text-rose-700 bg-rose-50 border-rose-200',
    neutral: 'text-slate-600 bg-slate-100 border-slate-200',
  };

  const TrendIcon = trendType === 'up' ? TrendingUp : trendType === 'down' ? TrendingDown : Minus;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-200 ${currentAccent.glow} ${className}`}
    >
      {/* Top gradient accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600" />

      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</span>
          <div className="mt-1 text-2xl font-extrabold text-slate-900 tracking-tight">{value}</div>
        </div>

        {Icon && (
          <div className={`p-2.5 rounded-xl border ${currentAccent.iconBg}`}>
            <Icon size={22} />
          </div>
        )}
      </div>

      {(subtitle || trendValue) && (
        <div className="mt-4 flex items-center justify-between text-xs pt-3 border-t border-slate-100">
          {trendValue && (
            <div className={`inline-flex items-center px-2 py-0.5 rounded-md border font-medium ${trendColors[trendType]}`}>
              <TrendIcon size={12} className="mr-1" />
              <span>{trendValue}</span>
            </div>
          )}
          {subtitle && <span className="text-slate-500">{subtitle}</span>}
        </div>
      )}
    </div>
  );
};

export default Card;
