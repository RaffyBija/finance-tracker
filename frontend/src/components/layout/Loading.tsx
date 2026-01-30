import {OrbitProgress} from 'react-loading-indicators'

export default function Loading() {
return (<div className='flex items-center justify-center'>
        <OrbitProgress variant="split-disc" color="#3161cc" size="large" text="" textColor="" />
      </div>
      );
    }