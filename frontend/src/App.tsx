import { Providers } from '@/app/Providers';
import { AppRoutes } from '@/app/AppRoutes';

function App() {
  return (
    <Providers>
      <AppRoutes />
    </Providers>
  );
}

export default App;
