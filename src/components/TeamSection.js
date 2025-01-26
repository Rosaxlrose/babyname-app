import React, { useEffect } from 'react';
import TeamMember from './TeamMember';
import Member1 from '../images/member1.jpg';

const TeamSection = () => {
  const teamMembers = [
    {
      name: "Rosmie Ruangprach",
      role: "Project Leader\nFullStack Developer",
      image: Member1,
      social: {
        github: "https://github.com/Rosaxlrose",
        facebook: "https://www.facebook.com/rosmie.mie.54",
        instagram: "https://www.instagram.com/rosaxlrose/"
      }
    },
    {
      name: "Tawanchai Srilert",
      role: "Lead Developer",
      image: Member1,
      social: {
        facebook: "https://facebook.com",
        twitter: "https://twitter.com",
        instagram: "https://instagram.com"
      }
    },
    {
      name: "Poonyapat Wongsatit",
      role: "Product Designer",
      image: Member1,
      social: {
        facebook: "https://facebook.com",
        twitter: "https://twitter.com",
        instagram: "https://instagram.com"
      }
    },
    {
      name: "Akethanick  Rungsawang",
      role: "Marketing Director",
      image: Member1,
      social: {
        facebook: "https://facebook.com",
        twitter: "https://twitter.com",
        instagram: "https://instagram.com"
      }
    },
    {
      name: "Anut Soratyatorn",
      role: "UX Researcher",
      image: Member1,
      social: {
        facebook: "https://facebook.com",
        twitter: "https://twitter.com",
        instagram: "https://instagram.com"
      }
    },
    {
      name: "Thanakorn Thitpaphong",
      role: "Tech Lead",
      image: Member1,
      social: {
        facebook: "https://facebook.com",
        twitter: "https://twitter.com",
        instagram: "https://instagram.com"
      }
    }
  ];

  useEffect(() => {
    const container = document.querySelector('.team-section-container');
    if (container) {
      for (let i = 0; i < 6; i++) {
        const bubble = document.createElement('div');
        bubble.className = 'floating-bubble';
        bubble.style.width = `${Math.random() * 100 + 50}px`;
        bubble.style.height = bubble.style.width;
        bubble.style.left = `${Math.random() * 100}%`;
        bubble.style.top = `${Math.random() * 100}%`;
        bubble.style.animationDelay = `${Math.random() * 5}s`;
        container.appendChild(bubble);
      }
    }
  }, []);

  const description = "เว็บไซต์นี้พัฒนาโดยนักศึกษาคณะวิทยาศาสตร์และเทคโนโลยี สาขาวิทยาการคอมพิวเตอร์\nมหาวิทยาลัยเทคโนโลยีราชมงคลพระนคร ชั้นปีที่ 3 รหัส 65";

  return (
    <div className="team-section-container min-h-screen bg-[#F6F6F7] relative overflow-hidden p-8">
      <div className="glass-container max-w-7xl mx-auto bg-white/70 backdrop-blur-lg rounded-3xl border border-white/20 p-8 relative z-10">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-semibold mb-4 bg-gradient-to-r from-[#0EA5E9] to-[#38BDF8] bg-clip-text text-transparent">
            The Journey of Talented and Hardworking Individuals
          </h1>
          <p className="text-[#8A898C] text-lg mb-8">
            These people making our product best
          </p>
          <p className="text-gray-600 max-w-2xl mx-auto">
            {description.split('\n').map((line, index) => (
              <React.Fragment key={index}>
                {line}
                <br />
              </React.Fragment>
            ))}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {teamMembers.map((member, index) => (
            <TeamMember key={index} {...member} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeamSection;