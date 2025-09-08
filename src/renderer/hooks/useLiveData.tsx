import { useEffect, useState } from 'react';
import { LiveDataProvider, LiveDataProviderStatus } from '../../live-data/liveDataTypes';
import { liveDataService } from '../services/liveDataService';

export default function useLiveData() {
  const [services, setServices] = useState<LiveDataProviderStatus[]>([]);
  const [servicesById, setServicesById] = useState<Record<string,LiveDataProviderStatus>>({});

  const update = async () => {
      const services = await liveDataService.getStatus()
      updateCurrentServices(services)
  }
  const updateCurrentServices = (services: LiveDataProvider[]) => {
    setServices(services)
    
    let newServicesById : Record<string,LiveDataProvider> = {}
    for(const s of services){
      newServicesById[s.id] = s
    }
    setServicesById(newServicesById)
  }
  
  useEffect(() => {
    update();

    const unsubscribe = liveDataService.subscribe(updateCurrentServices);

    return () => {
      unsubscribe();
    };
  }, []);

  const triggerUpdate = async (serviceId: string) : Promise<LiveDataProviderStatus | undefined> =>  {
    return await liveDataService.triggerUpdate(serviceId)
  }
  const updateConfig = async (serviceId: string, updates: Partial<Omit<LiveDataProvider,"id">>) : Promise<LiveDataProviderStatus> =>  {
    return liveDataService.updateConfig(serviceId, updates)
  }

  return { services, servicesById, triggerUpdate, updateConfig };
}