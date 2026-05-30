export default function SupportIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Chat bubble */}
      <path d="M12 3C7.03 3 3 6.58 3 11c0 2.1.9 4 2.36 5.42L4.5 20l3.86-1.29C9.33 19.23 10.63 19.5 12 19.5c4.97 0 9-3.58 9-8S16.97 3 12 3z"
        fill={color} opacity="0.15" />
      <path d="M12 3C7.03 3 3 6.58 3 11c0 2.1.9 4 2.36 5.42L4.5 20l3.86-1.29C9.33 19.23 10.63 19.5 12 19.5c4.97 0 9-3.58 9-8S16.97 3 12 3z"
        stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      {/* Headset arc */}
      <path d="M8.5 10.5a3.5 3.5 0 0 1 7 0" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      {/* Left ear cup */}
      <rect x="6.5" y="10.5" width="2" height="3" rx="1" fill={color} />
      {/* Right ear cup */}
      <rect x="15.5" y="10.5" width="2" height="3" rx="1" fill={color} />
      {/* Mic arm */}
      <path d="M17.5 13.5v.5a1.5 1.5 0 0 1-1.5 1.5h-1" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
