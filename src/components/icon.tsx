import { icons, type LucideProps } from 'lucide-react';

interface IconProps extends LucideProps {
  name: keyof typeof icons;
}

export const Icon = ({ name, ...props }: IconProps) => {
  const LucideIcon = icons[name];
  if (!LucideIcon) return null;
  return <LucideIcon {...props} />;
};
