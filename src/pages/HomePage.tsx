import { useEffect, useState } from 'react';
import HeroCarousel from '../components/home/HeroCarousel';
import LeagueCards from '../components/home/LeagueCards';
import MatchList from '../components/home/MatchList';

export default function HomePage() {
  return (
    <div className="flex-1 min-w-0">
       <HeroCarousel />
    
      <MatchList />
    </div>
  );
}