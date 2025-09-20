'use client';

// Force dynamic rendering to avoid SSR issues
export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Not Found</h2>
        <p className="mt-2 text-gray-600">Could not find the requested resource</p>
        <a href="/" className="mt-4 inline-block bg-blue-500 text-white px-4 py-2 rounded">
          Return Home
        </a>
      </div>
    </div>
  );
}