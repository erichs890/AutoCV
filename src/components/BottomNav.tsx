import { NavLink } from 'react-router-dom';
import { navItens } from './Sidebar';

export default function BottomNav() {
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-20 hidden h-[58px] gap-0.5 bg-side-bottom px-1.5 py-[7px] max-md:flex">
      {navItens.map(({ to, curto, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center gap-[3px] rounded-md text-xs font-bold ${isActive ? 'bg-blue-dark text-white' : 'text-white/75 hover:text-white active:bg-white/10'}`
          }
        >
          <Icon size={17} aria-hidden />
          {curto}
        </NavLink>
      ))}
    </nav>
  );
}
