// /api/admin/system/health - System Health API
// Returns health status of system services
// Requires platform admin authentication

import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';
import { getConfig } from '@/lib/admin/config';
import { Resend } from 'resend';

interface ServiceStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  latency_ms?: number;
  error?: string;
  message?: string;
}

interface BackgroundJobStatus {
  last_run: string | null;
  status: 'success' | 'failed' | 'never_run';
  message?: string;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: ServiceStatus;
    email: ServiceStatus;
    stripe: ServiceStatus;
    ai_provider: ServiceStatus;
  };
  background_jobs: {
    subscription_sync: BackgroundJobStatus;
    credit_reset: BackgroundJobStatus;
    invoice_generation: BackgroundJobStatus;
  };
}

/**
 * GET /api/admin/system/health
 * Returns system health status
 */
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!auth.success) {
    return auth.response;
  }

  const supabase = auth.serviceClient;
  const services: HealthResponse['services'] = {
    database: { status: 'unhealthy' },
    email: { status: 'unhealthy' },
    stripe: { status: 'unhealthy' },
    ai_provider: { status: 'unhealthy' }
  };

  // Check database health
  try {
    const start = Date.now();
    const { error } = await supabase.from('platform_config').select('key').limit(1);
    const latency = Date.now() - start;

    if (error) {
      services.database = { status: 'unhealthy', error: error.message };
    } else {
      services.database = { status: 'healthy', latency_ms: latency };
    }
  } catch (err) {
    services.database = {
      status: 'unhealthy',
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }

  // Check Email (Resend) health
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      services.email = {
        status: 'degraded',
        message: 'RESEND_API_KEY not configured'
      };
    } else {
      const resend = new Resend(resendApiKey);
      const start = Date.now();
      // Use domains.list() as a lightweight health check
      const { error } = await resend.domains.list();
      const latency = Date.now() - start;

      if (error) {
        services.email = {
          status: 'unhealthy',
          error: error.message,
          latency_ms: latency
        };
      } else {
        services.email = {
          status: 'healthy',
          latency_ms: latency
        };
      }
    }
  } catch (err) {
    services.email = {
      status: 'unhealthy',
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }

  // Check Stripe health (placeholder - skip for now)
  // TODO: Implement actual Stripe health check when configured
  services.stripe = {
    status: 'healthy',
    message: 'Not configured - placeholder',
    latency_ms: 0
  };

  // Check AI provider health (placeholder)
  // TODO: Implement actual AI provider health check when configured
  services.ai_provider = {
    status: 'healthy',
    message: 'Not configured - placeholder',
    latency_ms: 0
  };

  // Get background job status from platform_config
  let backgroundJobs: HealthResponse['background_jobs'] = {
    subscription_sync: { last_run: null, status: 'never_run' },
    credit_reset: { last_run: null, status: 'never_run' },
    invoice_generation: { last_run: null, status: 'never_run' }
  };

  try {
    const jobStatus = await getConfig<HealthResponse['background_jobs']>('background_jobs');
    if (jobStatus) {
      backgroundJobs = jobStatus;
    }
  } catch {
    // If config doesn't exist, use defaults
  }

  // Determine overall status
  const allServices = Object.values(services);
  const unhealthyCount = allServices.filter(s => s.status === 'unhealthy').length;
  const degradedCount = allServices.filter(s => s.status === 'degraded').length;

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (unhealthyCount > 0) {
    // If database is down, system is unhealthy. Otherwise degraded.
    overallStatus = services.database.status === 'unhealthy' ? 'unhealthy' : 'degraded';
  } else if (degradedCount > 0) {
    overallStatus = 'degraded';
  }

  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services,
    background_jobs: backgroundJobs
  };

  return NextResponse.json(response);
}
