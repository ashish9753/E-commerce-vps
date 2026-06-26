import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="text-center py-32 px-4">
      <div className="text-[100px] font-extrabold text-mute leading-none">404</div>
      <h1 className="text-3xl font-bold mt-4 mb-2">Page not found</h1>
      <p className="text-mute mb-6">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <Link to="/" className="btn btn-primary inline-block">
        Go to homepage
      </Link>
    </div>
  );
}
