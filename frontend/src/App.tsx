import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import NewBrief from './pages/NewBrief'
import Gallery from './pages/Gallery'
import GenerationDetail from './pages/GenerationDetail'
import BrandManagement from './pages/BrandManagement'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/new" element={<NewBrief />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/generation/:id" element={<GenerationDetail />} />
        <Route path="/brands" element={<BrandManagement />} />
      </Routes>
    </Layout>
  )
}

export default App
