import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function UserHistory({ user, onBack }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchHistory() {
      // Usamos un join con la tabla gyms para traer el nombre del gym
      const { data, error } = await supabase
        .from('check_ins')
        .select(`
          id,
          created_at,
          photo_url,
          gyms (
            name
          )
        `)
        .eq('user_id', user.user_id)
        .order('created_at', { ascending: false })

      if (data) {
        setHistory(data)
      }
      setLoading(false)
    }
    
    fetchHistory()
  }, [user.user_id])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 font-sans flex justify-center">
      <div className="w-full max-w-md space-y-6">
        
        <header className="flex items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 gap-4">
          <button 
            onClick={onBack} 
            className="p-2 -ml-2 text-gray-400 hover:text-black hover:bg-gray-50 rounded-lg transition-colors"
          >
            {/* Ícono de flecha regresar */}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <img 
            src={user.avatar_url || 'https://via.placeholder.com/100'} 
            alt={user.full_name} 
            className="w-10 h-10 rounded-full object-cover border border-gray-200" 
          />
          
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-800 text-sm truncate">{user.full_name}</h2>
            <p className="text-xs text-gray-500">{user.total_attendances} asistencias</p>
          </div>
        </header>

        <section className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 min-h-[50vh]">
          <h3 className="text-lg font-semibold mb-6">Historial</h3>
          
          {loading ? (
            <p className="text-center text-gray-500 text-sm py-8">Cargando historial...</p>
          ) : history.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-8">Este atleta aún no tiene registros.</p>
          ) : (
            <div className="space-y-6">
              {history.map((record) => (
                <div key={record.id} className="border border-gray-100 rounded-xl overflow-hidden bg-gray-50 shadow-sm">
                  {record.photo_url ? (
                    <div className="aspect-[4/3] bg-black relative">
                      <img 
                        src={record.photo_url} 
                        alt="Registro de asistencia" 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                  ) : (
                    <div className="aspect-[4/3] bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-400 text-xs">Sin foto</span>
                    </div>
                  )}
                  
                  <div className="p-4 bg-white border-t border-gray-100">
                    <p className="font-medium text-sm text-gray-900">
                      {record.gyms?.name || 'Gimnasio (N/A)'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 capitalize">
                      {new Date(record.created_at).toLocaleDateString('es-ES', { 
                        weekday: 'long', 
                        day: 'numeric', 
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}