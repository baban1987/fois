// app/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { TrackingApiResponse, TrackingData } from '../app/api/track-loco/route';

const TrackingMap = dynamic(() => import('@/components/TrackingMap'), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-gray-200 animate-pulse rounded-lg flex items-center justify-center"><p>Loading Map...</p></div>,
});

export default function Home() {
  const [locoId, setLocoId] = useState('37875');
  const [currentData, setCurrentData] = useState<TrackingData | null>(null);
  const [historyData, setHistoryData] = useState<TrackingApiResponse['history']>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = async (id: string) => {
    // Only set loading on the initial fetch for a better polling experience
    if (!isTracking) {
        setIsLoading(true);
    }
    setError(null);
    try {
      const response = await fetch('/api/track-loco', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locoId: id.trim() }),
      });
      const data: TrackingApiResponse | { error: string } = await response.json();

      if (!response.ok || 'error' in data) {
        throw new Error((data as { error: string }).error || 'Failed to fetch data');
      }
      
      setCurrentData(data.current);
      setHistoryData(data.history);
      // If this is the first successful fetch, set tracking to true
      if (!isTracking) {
          setIsTracking(true);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      setIsTracking(false); // Stop tracking on any error
    } finally {
      setIsLoading(false);
    }
  };
  
  // Effect for polling
  useEffect(() => {
    if (isTracking) {
      // Set up the interval
      intervalRef.current = setInterval(() => fetchData(locoId), 30000);
    } else {
      // Clear the interval if tracking is stopped
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    // Cleanup function to clear interval on component unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isTracking, locoId]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isTracking) {
      // If currently tracking, the button acts as a STOP button
      setIsTracking(false);
    } else {
      // If not tracking, the button acts as a TRACK button
      setCurrentData(null); // Clear old data
      setHistoryData([]);
      fetchData(locoId); // Start a new tracking session
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 md:p-12 bg-gray-50">
      <h1 className="text-2xl md:text-4xl font-bold text-gray-800 mb-8">FOIS Loco Tracker</h1>
      
      {/* THE FIX: Simplified Form and Button Logic */}
      <div className="w-full max-w-md bg-white p-6 rounded-lg shadow-md">
        <form onSubmit={handleFormSubmit} className="flex space-x-2">
          <div className="flex-grow">
            <label htmlFor="locoId" className="sr-only">Locomotive ID</label>
            <input
              type="text"
              name="locoId"
              id="locoId"
              value={locoId}
              onChange={(e) => setLocoId(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2"
              placeholder="Enter Locomotive ID"
              // Only disable while actively loading the FIRST point
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className={`inline-flex items-center justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2
            ${isTracking 
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'}
            disabled:bg-gray-400 disabled:cursor-not-allowed`}
          >
            {isLoading ? 'Loading...' : (isTracking ? 'Stop' : 'Track')}
          </button>
        </form>
      </div>

      <div className="mt-8 w-full max-w-5xl h-[60vh] bg-white p-4 rounded-lg shadow-lg">
        {error && <div className="text-red-600 text-center p-4">{error}</div>}
        
        {currentData ? (
          <TrackingMap currentData={currentData} historyData={historyData} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>{isLoading ? 'Fetching initial data...' : 'Enter a Loco ID and click Track.'}</p>
          </div>
        )}
      </div>
    </main>
  );
}