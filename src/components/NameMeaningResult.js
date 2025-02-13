import React, { useEffect, useState } from 'react';
import { TypeAnimation } from 'react-type-animation';

const NameMeaningResult = ({ name, meaning, tags, gender }) => {
  const [key, setKey] = useState(0);
  const [previousName, setPreviousName] = useState('');

  useEffect(() => {
    setKey(prev => prev + 1);
    setPreviousName(name || '');
  }, [name, meaning]);

  if (!meaning) return null;

  const displayName = name || previousName || '';

  return (
    <div className="mt-6 p-4 bg-white rounded-lg shadow space-y-4">
      <div className="flex items-start space-x-4">
        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white flex-shrink-0">
          🧠
        </div>
        <div className="flex-1 space-y-2">
          <TypeAnimation
            key={key}
            sequence={[
              `ชื่อ "${displayName}" มีความหมายว่า:\n${meaning}`,
            ]}
            wrapper="pre"
            speed={50}
            className="whitespace-pre-wrap text-gray-700 font-kanit"
            cursor={true}
          />
        </div>
      </div>
    </div>
  );
};

export default NameMeaningResult;