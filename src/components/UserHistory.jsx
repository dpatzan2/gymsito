import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'

export default function UserHistory({ user, onBack }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [isProgressExpanded, setIsProgressExpanded] = useState(false)
  
  const todayDateObj = new Date()
  
  // Generar los ultimos meses
  const months = useMemo(() => {
    const d = new Date()
    d.setDate(1) // Para evitar problemas de fin de mes
    const m = []
    for (let i = 0; i < 6; i++) {
      const date = new Date(d.getFullYear(), d.getMonth() - i, 1)
      m.push({
        year: date.getFullYear(),
        month: date.getMonth(),
        label: date.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())
      })
    }
    return m
  }, [])

  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0)
  const selectedMonth = months[selectedMonthIdx]

  // Obtener las semanas del mes seleccionado
  const weeksInMonth = useMemo(() => {
    const firstDay = new Date(selectedMonth.year, selectedMonth.month, 1)
    const lastDay = new Date(selectedMonth.year, selectedMonth.month + 1, 0)
    
    let currentMonday = new Date(firstDay)
    const offset = currentMonday.getDay() === 0 ? 6 : currentMonday.getDay() - 1
    currentMonday.setDate(currentMonday.getDate() - offset)
    currentMonday.setHours(0,0,0,0)
    
    const w = []
    while (currentMonday <= lastDay) {
      const sunday = new Date(currentMonday)
      sunday.setDate(sunday.getDate() + 6)
      sunday.setHours(23,59,59,999)
      
      const days = []
      for(let i=0; i<7; i++) {
        const rD = new Date(currentMonday)
        rD.setDate(rD.getDate() + i)
        days.push({
          date: rD,
          id: i + 1, // 1=Lunes, 7=Domingo
          label: rD.getDate().toString()
        })
      }
      
      w.push({
        start: new Date(currentMonday),
        end: new Date(sunday),
        days
      })
      
      currentMonday.setDate(currentMonday.getDate() + 7)
    }
    return w
  }, [selectedMonth])

  useEffect(() => {
    async function fetchHistory() {
      const { data } = await supabase
        .from('check_ins')
        .select(`
          id,
          created_at,
          photo_url,
          is_comodin,
          replaced_day,
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
            <p className="text-xs text-gray-500">{user.scorePercentage}% asistencia este mes</p>
          </div>
        </header>

        {/* Sección del Calendario / Timeline Mensual */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <button 
            onClick={() => setIsProgressExpanded(!isProgressExpanded)}
            className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-900">Progreso</h3>
              <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded">
                Meta: {user.target_days?.length || 0}/sem
              </span>
            </div>
            <svg 
              className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isProgressExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {isProgressExpanded && (
            <div className="p-4 pt-0 border-t border-gray-50">
              <div className="mb-4 mt-2">
                <select
                  value={selectedMonthIdx}
                  onChange={(e) => setSelectedMonthIdx(Number(e.target.value))}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black transition-colors"
                >
                  {months.map((m, idx) => (
                    <option key={idx} value={idx}>
                      {m.label} {idx === 0 ? '(Actual)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-7 gap-x-2 gap-y-4 relative mt-2 pt-2">
                {/* Cabecera L M X J V S D */}
                {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, i) => (
                  <div key={i} className="text-center text-xs font-semibold text-gray-500 mb-1">
                    {day}
                  </div>
                ))}

            {weeksInMonth.map((week, wIdx) => {
              // Filtrar asistencias limitadas a esta semana específica
              const weekHistory = history.filter(record => {
                const d = new Date(record.created_at)
                return d >= week.start && d <= week.end
              })

              const weeklyCheckins = [...new Set(weekHistory.filter(c => !c.is_comodin).map(c => new Date(c.created_at).getDay() || 7))]
              const comodinCheckins = [...new Set(weekHistory.filter(c => c.is_comodin).map(c => new Date(c.created_at).getDay() || 7))]
              const replacedCheckins = [...new Set(weekHistory.filter(c => c.replaced_day).map(c => c.replaced_day))]

              return week.days.map((day) => {
                const isTarget = user.target_days?.includes(day.id)
                const hasAttendedNormal = weeklyCheckins.includes(day.id)
                const hasAttendedComodin = comodinCheckins.includes(day.id)
                const isReplaced = replacedCheckins.includes(day.id)
                
                const dateOfCircle = day.date
                const isCurrentMonth = dateOfCircle.getMonth() === selectedMonth.month
                
                const isCurrentDay = dateOfCircle.toDateString() === todayDateObj.toDateString()
                const isPast = dateOfCircle < todayDateObj && !isCurrentDay

                let opacityClass = isCurrentMonth ? "" : "opacity-30"

                let circleClass = `w-10 h-10 rounded-full flex mx-auto items-center justify-center text-sm font-medium border-[2.5px] transition-all bg-white relative z-10 ${opacityClass} `
                
                if (hasAttendedNormal) {
                  circleClass += "border-green-500 text-green-600 font-bold"
                } else if (isReplaced) {
                  circleClass += "border-blue-400 text-blue-500 bg-blue-50 font-bold"
                } else if (hasAttendedComodin) {
                  circleClass += "border-blue-500 text-blue-600 font-bold"
                } else if (isTarget && isPast) {
                  circleClass += "border-red-400 text-red-500 bg-red-50"
                } else if (isTarget && !isPast) {
                  circleClass += "border-gray-800 text-gray-800 border-dashed"
                } else {
                  circleClass += "border-gray-200 text-gray-400 font-normal"
                }

                return (
                  <div key={`${wIdx}-${day.id}`} className="flex flex-col items-center gap-1.5 relative">
                    {/* Linea de fondo horizontal para la semana */}
                    {day.id === 1 && (
                      <div className="absolute top-5 left-4 w-[calc(700%-2rem)] h-0.5 bg-gray-100 -z-10 hidden sm:block"></div>
                    )}
                    
                    <div className={`relative ${isCurrentDay ? 'scale-110' : ''}`}>
                      <div className={circleClass}>
                        <span className="text-[11px] sm:text-sm">{day.label}</span>
                      </div>
                      {isCurrentDay && (
                        <div className="absolute inset-0 rounded-full ring-4 ring-orange-100 -z-10"></div>
                      )}
                    </div>
                    
                    <div className={`h-4 flex items-center justify-center ${opacityClass}`}>
                      {hasAttendedNormal && (
                        <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      )}
                      {isReplaced && (
                        <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      )}
                      {hasAttendedComodin && (
                        <span className="text-[9px] bg-blue-100 text-blue-700 px-1 rounded uppercase tracking-wider font-bold">CMD</span>
                      )}
                      {isTarget && isPast && !hasAttendedNormal && !isReplaced && (
                        <svg className="w-3.5 h-3.5 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                      )}
                      {isTarget && !isPast && !hasAttendedNormal && (
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                      )}
                      {!isTarget && !hasAttendedComodin && (
                        <div className="w-1 h-1 rounded-full bg-gray-200"></div>
                      )}
                    </div>
                  </div>
                )
              })
            })}
              </div>
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 min-h-[50vh]">
          <h3 className="text-lg font-semibold mb-4 px-1">Historial</h3>
          
          {loading ? (
            <p className="text-center text-gray-500 text-sm py-8">Cargando historial...</p>
          ) : history.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-8">Sin registros.</p>
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
