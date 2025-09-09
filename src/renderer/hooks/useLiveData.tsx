import { useEffect, useMemo, useState } from 'react';
import { LiveDataProviderStatus, LiveDataProvider } from '../../live-data/LiveDataTypes';
import { liveDataService } from '../services/liveDataService';
import { useActiveProject } from '../projects/ProjectContext';

export default function useLiveData() {
  const { projectId: activeProjectId } = useActiveProject();

  const [allServices, setAllServices] = useState<LiveDataProviderStatus[]>([]);
  const [services, setServices] = useState<LiveDataProviderStatus[]>([]);
  const [servicesById, setServicesById] = useState<Record<string,LiveDataProviderStatus>>({});

  const filterForProject = (items: LiveDataProviderStatus[], projectId: string) => {
    return (items || []).filter(s => (s.scope !== 'project') || (s.projectId === projectId));
  };

  const recomputeVisible = (items: LiveDataProviderStatus[], projectId: string) => {
    const filtered = filterForProject(items, projectId);
    setServices(filtered);
    const map: Record<string, LiveDataProviderStatus> = {};
    for (const s of filtered) map[s.id] = s;
    setServicesById(map);
  };

  const update = async () => {
    const statuses = await liveDataService.getStatus();
    setAllServices(statuses);
    recomputeVisible(statuses, activeProjectId);
  };

  const updateCurrentServices = (statuses: LiveDataProviderStatus[]) => {
    setAllServices(statuses);
    recomputeVisible(statuses, activeProjectId);
  };
  
  useEffect(() => {
    update();

    const unsubscribe = liveDataService.subscribe(updateCurrentServices);

    return () => {
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If active project changes, re-filter without refetching
  useEffect(() => {
    recomputeVisible(allServices, activeProjectId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  const triggerUpdate = async (serviceId: string) : Promise<LiveDataProviderStatus | undefined> =>  {
    return await liveDataService.triggerUpdate(serviceId)
  }
  const updateConfig = async (serviceId: string, updates: Partial<Omit<LiveDataProvider,"id">>) : Promise<LiveDataProviderStatus> =>  {
    return liveDataService.updateConfig(serviceId, updates)
  }
  const addService = async (service: LiveDataProvider) : Promise<LiveDataProviderStatus> => {
    return await liveDataService.addService(service)
  }
  const removeService = async (serviceId: string) : Promise<boolean> => {
    return await liveDataService.removeService(serviceId)
  }

  return { services, servicesById, triggerUpdate, updateConfig, addService, removeService };
}