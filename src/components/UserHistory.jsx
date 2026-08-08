import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'

export default function UserHistory({ user, onBack }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [isProgressExpanded, setIsProgressExpanded] = useState(false)
  
  const todayDateObj = useMemo(() => new Date(), [])
  
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

  // Historial filtrado estrictamente por el mes seleccionado
  const filteredHistory = useMemo(() => {
    return history.filter(record => {
      const d = new Date(record.created_at)
      return d.getFullYear() === selectedMonth.year && d.getMonth() === selectedMonth.month
    })
  }, [history, selectedMonth])

  // Estadísticas calculadas dinámicamente para el mes seleccionado
  const monthStats = useMemo(() => {
    const targetDays = user.target_days || []
    const total = filteredHistory.length
    const comodines = filteredHistory.filter(c => c.is_comodin).length

    if (targetDays.length === 0) {
      return { total, comodines, percentage: 0, expectedDays: 0 }
    }

    const isCurrentMonth = todayDateObj.getFullYear() === selectedMonth.year && todayDateObj.getMonth() === selectedMonth.month
    const lastDayToCount = isCurrentMonth 
      ? todayDateObj.getDate() 
      : new Date(selectedMonth.year, selectedMonth.month + 1, 0).getDate()

    let expectedDays = 0
    for (let day = 1; day <= lastDayToCount; day++) {
      const d = new Date(selectedMonth.year, selectedMonth.month, day)
      const dayOfWeek = d.getDay() || 7
      if (targetDays.includes(dayOfWeek)) {
        expectedDays++
      }
    }

    let validCheckins = 0
    filteredHistory.forEach(c => {
      const d = new Date(c.created_at)
      const dayOfWeek = d.getDay() || 7
      if (targetDays.includes(dayOfWeek) || c.is_comodin) {
        validCheckins++
      }
    })

    let percentage = expectedDays > 0 ? Math.round((validCheckins / expectedDays) * 100) : 0
    percentage = Math.min(percentage, 100)

    return { total, comodines, percentage, expectedDays }
  }, [filteredHistory, selectedMonth, user.target_days, todayDateObj])

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
      <div className="w-full max-w-md space-y-5">
        
        {/* Encabezado del Perfil */}
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
            <p className="text-xs text-gray-500">
              {monthStats.percentage}% asistencia en {selectedMonth.label.split(' ')[0]}
            </p>
          </div>
        </header>

        {/* Selector de Mes + Resumen de Estadísticas */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setSelectedMonthIdx(prev => Math.min(months.length - 1, prev + 1))}
              disabled={selectedMonthIdx >= months.length - 1}
              className="p-2 border border-gray-200 rounded-lg text-gray-600 bg-gray-50 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Mes anterior"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <select
              value={selectedMonthIdx}
              onChange={(e) => setSelectedMonthIdx(Number(e.target.value))}
              className="flex-1 p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-800 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-black transition-colors"
            >
              {months.map((m, idx) => (
                <option key={idx} value={idx}>
                  {m.label} {idx === 0 ? '(Actual)' : ''}
                </option>
              ))}
            </select>

            <button
              onClick={() => setSelectedMonthIdx(prev => Math.max(0, prev - 1))}
              disabled={selectedMonthIdx === 0}
              className="p-2 border border-gray-200 rounded-lg text-gray-600 bg-gray-50 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Mes siguiente"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-2 text-center">
              <span className="block text-[10px] text-gray-500 font-medium uppercase tracking-wider">Efectividad</span>
              <span className="text-sm font-bold text-gray-900">{monthStats.percentage}%</span>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-2 text-center">
              <span className="block text-[10px] text-gray-500 font-medium uppercase tracking-wider">Asistencias</span>
              <span className="text-sm font-bold text-green-600">{monthStats.total}</span>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-2 text-center">
              <span className="block text-[10px] text-gray-500 font-medium uppercase tracking-wider">Comodines</span>
              <span className="text-sm font-bold text-blue-600">{monthStats.comodines}</span>
            </div>
          </div>
        </div>

        {/* Sección del Calendario / Timeline Mensual */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <button 
            onClick={() => setIsProgressExpanded(!isProgressExpanded)}
            className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-900">Calendario de Asistencia</h3>
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

        {/* Sección del Historial de Fotos (Filtradas por el mes seleccionado) */}
        <section className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 min-h-[40vh]">
          <div className="flex justify-between items-center mb-4 px-1">
            <h3 className="text-lg font-semibold text-gray-900">
              Fotos de {selectedMonth.label}
            </h3>
            <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full">
              {filteredHistory.length} {filteredHistory.length === 1 ? 'foto' : 'fotos'}
            </span>
          </div>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-2"></div>
              <p className="text-gray-400 text-xs">Cargando historial...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-gray-50/70 border border-dashed border-gray-200 rounded-xl">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl mb-2 text-gray-400">
                📷
              </div>
              <h4 className="font-semibold text-gray-700 text-sm">Sin fotos en este mes</h4>
              <p className="text-xs text-gray-400 mt-1 max-w-xs">
                No hay registros de asistencia para {selectedMonth.label.toLowerCase()}.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredHistory.map((record) => (
                <div
                  key={record.id}
                  className="group relative rounded-xl overflow-hidden bg-gray-100 shadow-sm cursor-pointer border border-gray-100 hover:shadow-md transition-all duration-200"
                  onClick={() => record.photo_url && setSelectedPhoto(record)}
                >
                  {/* Badge si fue con Comodín */}
                  {record.is_comodin && (
                    <div className="absolute top-2 left-2 z-10 bg-blue-600/90 backdrop-blur-md text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                      <span>🃏</span> Comodín
                    </div>
                  )}

                  {record.photo_url ? (
                    <div className="aspect-square bg-black overflow-hidden">
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
                  
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 pt-6">
                    <p className="text-white text-xs font-semibold leading-tight truncate">
                      {record.gyms?.name || 'Gimnasio'}
                    </p>
                    <p className="text-white/80 text-[11px] mt-0.5 capitalize leading-tight flex items-center justify-between">
                      <span>
                        {new Date(record.created_at).toLocaleDateString('es-ES', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short'
                        })}
                      </span>
                      <span className="text-[10px] text-white/60">
                        {new Date(record.created_at).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Modal de Previsualización de Foto de Alta Resolución */}
        {selectedPhoto && (
          <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 transition-all duration-300"
            onClick={() => setSelectedPhoto(null)}
          >
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 p-2.5 text-white/80 hover:text-white bg-white/15 hover:bg-white/25 rounded-full backdrop-blur-md transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="relative max-w-full max-h-[75vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
              {selectedPhoto.is_comodin && (
                <span className="absolute top-3 left-3 z-10 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 backdrop-blur-md">
                  🃏 Asistencia por Comodín
                </span>
              )}
              <img
                src={selectedPhoto.photo_url}
                alt="Registro de asistencia"
                className="max-w-full max-h-[72vh] object-contain rounded-2xl shadow-2xl border border-white/10"
              />
            </div>

            <div
              className="mt-4 bg-white/10 backdrop-blur-md border border-white/15 px-5 py-3 rounded-2xl text-center max-w-xs w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-white font-semibold text-base">
                {selectedPhoto.gyms?.name || 'Gimnasio (N/A)'}
              </p>
              <p className="text-white/70 text-xs mt-0.5 capitalize font-medium">
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

