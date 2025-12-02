import { CheckCircle, AlertCircle, AlertTriangle, MinusCircle } from 'lucide-react';
import { Status } from '@/lib/services/game-week.service';

interface StatusIndicatorProps {
  status: Status;
  size?: 'sm' | 'md' | 'lg';
  large?: boolean;
}

const statusConfig = {
  green: {
    color: 'bg-green-100 text-green-800 border-green-300',
    icon: CheckCircle,
    label: 'Ready'
  },
  yellow: {
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    icon: AlertCircle,
    label: 'In Progress'
  },
  red: {
    color: 'bg-red-100 text-red-800 border-red-300',
    icon: AlertTriangle,
    label: 'Needs Attention'
  },
  gray: {
    color: 'bg-gray-100 text-gray-600 border-gray-300',
    icon: MinusCircle,
    label: 'Not Started'
  }
};

export default function StatusIndicator({ status, size = 'md', large = false }: StatusIndicatorProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  // If large prop is true, use 'lg' size
  const effectiveSize = large ? 'lg' : size;

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 rounded-full border font-medium
        ${config.color}
        ${sizeClasses[effectiveSize]}
      `}
    >
      <Icon className={iconSizes[effectiveSize]} />
      {config.label}
    </div>
  );
}
