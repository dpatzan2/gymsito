import { useState } from 'react'
import { supabase } from '../supabaseClient'

const DAYS_OF_WEEK = [
  { id: 1, name: 'Lunes' },
  { id: 2, name: 'Martes' },
  { id: 3, name: 'Miércoles' },
  { id: 4, name: 'Jueves' },
  { id: 5, name: 'Viernes' },
  { id: 6, name: 'Sábado' },
  { id: 7, name: 'Domingo' },
]

export default function TargetDaysForm({ user, onComplete }) {
  const [selectedDays, setSelectedDays] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleToggleDay = (dayId) => {
    setSelectedDays(prev => 
      prev.includes(dayId) 
        ? prev.filter(id => id !== dayId) 
        : [...prev, dayId].sort()
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (selectedDays.length === 0) {
      setError('Por favor selecciona al menos un día para entrenar.')
      return
    }

    setSaving(true)
    setError(null)

    const { error: updateError } = await supabase
      .from('profiles')
      .upsert({ 
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || 'Atleta',
        avatar_url: user.user_metadata?.avatar_url || '',
        target_days: selectedDays 
      })
      .eq('id', user.id)

    if (updateError) {
      console.error(updateError)
      setError('Hubo un error al guardar tus días. Intenta de nuevo.')
      setSaving(false)
    } else {
      // Pasamos los dias seleccionados de vuelta a App.jsx
      onComplete(selectedDays)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Bienvenido, {user.user_metadata?.full_name?.split(' ')[0] || 'Atleta'}
        </h2>
        <p className="text-sm text-gray-500 mb-8">
          Configura tus días de entrenamiento para llevar el registro de tus asistencias.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-wrap gap-3 justify-center mb-8">
            {DAYS_OF_WEEK.map((day) => {
              const isSelected = selectedDays.includes(day.id)
              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => handleToggleDay(day.id)}
                  className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-black text-white border-2 border-black'
                      : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {day.name}
                </button>
              )
            })}
          </div>

          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

          <button 
            type="submit" 
            disabled={saving}
            className="w-full py-3 px-4 bg-black text-white text-sm font-medium rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
          >
            {saving ? 'Guardando configuración...' : 'Continuar'}
          </button>
        </form>
      </div>
    </div>
  )
}