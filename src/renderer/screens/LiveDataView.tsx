import React from 'react';

const LiveDataView: React.FC = () => {
  // Mock data for live data services
  const services = [
    {
      name: 'Agent Prices',
      lastUpdated: '2023-10-27T10:00:00Z',
      status: 'Up to date',
    },
    {
      name: 'NPM Package Versions',
      lastUpdated: '2023-10-20T14:30:00Z',
      status: 'Stale',
    },
    {
      name: 'Third-party API Status',
      lastUpdated: '2023-10-27T11:00:00Z',
      status: 'Up to date',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Up to date':
        return 'text-green-500';
      case 'Stale':
        return 'text-yellow-500';
      case 'Error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="p-4 h-full overflow-y-auto">
      <h1 className="text-2xl font-bold mb-4">Live Data Services</h1>
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow">
        <ul className="divide-y divide-gray-200 dark:divide-neutral-700">
          {services.map((service, index) => (
            <li key={index} className="p-4 flex justify-between items-center">
              <div>
                <p className="font-semibold">{service.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Last Updated: {new Date(service.lastUpdated).toLocaleString()}
                </p>
              </div>
              <div>
                <span className={`text-sm font-medium ${getStatusColor(service.status)}`}>
                  {service.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default LiveDataView;
