import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFacebook, faGithub, faInstagram } from '@fortawesome/free-brands-svg-icons';
import './NameList.css';
import './MatchForm.css';

const TeamMember = ({ name, role, image, social }) => {
    return (
      <div className="group relative overflow-hidden rounded-3xl aspect-square">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        
        {/* Overlay that appears on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-0 left-0 right-0 p-6 translate-y-6 group-hover:translate-y-0 transition-transform duration-300">
            <h3 className="text-xl font-semibold text-white mb-1">{name}</h3>
            <p className="text-gray-300 mb-4">
              {role.split('\n').map((line, index) => (
                <React.Fragment key={index}>
                  {line}
                  <br />
                </React.Fragment>
              ))}
            </p>
            <div className="flex gap-4 justify-center">
              {social?.github && (
                <a href={social.github} target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#0EA5E9] transition-colors">
                  <FontAwesomeIcon icon={faGithub} size="lg" />
                </a>
              )}
              {social?.facebook && (
                <a href={social.facebook} target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#0EA5E9] transition-colors">
                  <FontAwesomeIcon icon={faFacebook} size="lg" />
                </a>
              )}
              {social?.instagram && (
                <a href={social.instagram} target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#0EA5E9] transition-colors">
                  <FontAwesomeIcon icon={faInstagram} size="lg" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  export default TeamMember;