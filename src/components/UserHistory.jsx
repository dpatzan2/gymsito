import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function UserHistory({ user, onBack }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState(null)

  useEffect(() => {
    async function fetchHistory() {
      const { data } = await supabase
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

        <section className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 min-h-[50vh]">
          <h3 className="text-lg font-semibold mb-4 px-1">Historial</h3>
          
          {loading ? (
            <p className="text-center text-gray-500 text-sm py-8">Cargando historial...</p>
          ) : history.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-8">Este atleta aún no tiene registros.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {history.map((record) => (
                <div
                  key={record.id}
                  className="group relative rounded-xl overflow-hidden bg-gray-100 shadow-sm cursor-pointer"
                  onClick={() => record.photo_url && setSelectedPhoto(record)}
                >
                  {record.photo_url ? (
                    <div className="aspect-square bg-black">
                      <img
                        src={record.photo_url}
                        alt="Registro de asistencia"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="aspect-square bg-gray-200 flex items-center justify-center">
                      <div className="text-center">
                        <svg className="w-8 h-8 text-gray-300 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-gray-400 text-[11px]">Sin foto</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2.5 pt-6">
                    <p className="text-white text-xs font-medium leading-tight truncate">
                      {record.gyms?.name || 'Gimnasio (N/A)'}
                    </p>
                    <p className="text-white/75 text-[11px] mt-0.5 capitalize leading-tight">
                      {new Date(record.created_at).toLocaleDateString('es-ES', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
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

        {selectedPhoto && (
          <div
            className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <img
              src={selectedPhoto.photo_url}
              alt="Registro de asistencia"
              className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            <div
              className="mt-4 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-white font-medium text-sm">
                {selectedPhoto.gyms?.name || 'Gimnasio (N/A)'}
              </p>
              <p className="text-white/60 text-xs mt-1 capitalize">
                {new Date(selectedPhoto.created_at).toLocaleDateString('es-ES', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}