import { useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Footer from './components/Footer';
import BottomNav from './components/BottomNav';
import Painel from './pages/Painel';
import Curriculo from './pages/Curriculo';
import Plataformas from './pages/Plataformas';
import Automacao from './pages/Automacao';
import Configuracoes from './pages/Configuracoes';
import type { EstadoRobo } from './types';

export interface AppContexto {
  robo: EstadoRobo;
  setRobo: (estado: EstadoRobo) => void;
}

const titulos: Record<string, string> = {
  '/painel': 'Painel',
  '/curriculo': 'Currículo',
  '/plataformas': 'Plataformas',
  '/automacao': 'Automação',
  '/configuracoes': 'Configurações',
};

function Layout() {
  const [robo, setRobo] = useState<EstadoRobo>('ativo');
  const [menuAberto, setMenuAberto] = useState(false);
  const titulo = titulos[useLocation().pathname] ?? 'AutoCV';

  useEffect(() => {
    document.title = `${titulo} — AutoCV`;
  }, [titulo]);

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar robo={robo} aberto={menuAberto} onFechar={() => setMenuAberto(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar titulo={titulo} onAbrirMenu={() => setMenuAberto(true)} />
        <main className="flex-1 overflow-y-auto p-[18px] max-md:p-[11px] max-md:pb-[70px]">
          <Outlet context={{ robo, setRobo } satisfies AppContexto} />
        </main>
        <Footer robo={robo} />
      </div>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="painel" element={<Painel />} />
        <Route path="curriculo" element={<Curriculo />} />
        <Route path="plataformas" element={<Plataformas />} />
        <Route path="automacao" element={<Automacao />} />
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="*" element={<Navigate to="/painel" replace />} />
      </Route>
    </Routes>
  );
}
