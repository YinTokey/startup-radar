/**
 * Get the base URL for ISR server-side fetching
 * This handles the differences between development, preview, and production environments
 */
export function getBaseUrl(): string {
  // For Vercel deployments
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // For production
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  
  // For development
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  
  // Fallback
  return 'http://localhost:3000';
}

/**
 * Create a fetch function with ISR configuration
 */
export function createIsrFetch(revalidateTime: number = 60) {
  return (url: string, options?: RequestInit) => {
    return fetch(url, {
      ...options,
      next: {
        revalidate: revalidateTime,
        tags: ['posts', 'analytics']
      }
    });
  };
}

/**
 * Trigger revalidation for ISR tags
 */
export async function triggerRevalidation(tags: string[], secret?: string) {
  const baseUrl = getBaseUrl();
  
  try {
    const response = await fetch(`${baseUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret && { 'x-revalidate-secret': secret })
      },
      body: JSON.stringify({ tags })
    });

    if (!response.ok) {
      throw new Error(`Revalidation failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to trigger revalidation:', error);
    throw error;
  }
} 