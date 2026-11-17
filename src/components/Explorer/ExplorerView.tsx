import React from 'react';
import { OpeningFilterPanel } from './OpeningFilterPanel';
import { OpeningTreeCanvas } from './OpeningTreeCanvas';

export const ExplorerView: React.FC = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <section className="lg:col-span-5 xl:col-span-4">
        <OpeningFilterPanel />
      </section>

      <section className="lg:col-span-7 xl:col-span-8">
        <OpeningTreeCanvas />
      </section>
    </div>
  );
};
