interface ValueBlurProps {
  children: React.ReactNode;
  hidden: boolean;
  className?: string;
}

export default function ValueBlur({ children, hidden, className = "" }: ValueBlurProps) {
  return (
    <div
      className={`transition-all duration-300 ${
        hidden ? "blur-sm opacity-30 select-none pointer-events-none" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
