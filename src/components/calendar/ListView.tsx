import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Edit, Trash2, FileText } from 'lucide-react';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';
import { calculateLessonHours, calculateRealHours } from '../../utils/timeCalculations';
import { useState, useEffect } from 'react';
import html2pdf from 'html2pdf.js';

interface ListViewProps {
  lessons: any[];
  totalCompletedHours: number;
  onEditLesson: (lesson: any) => void;
  onLessonClick: (lesson: any) => void;
  onLessonUpdated: () => void;
}

export default function ListView({ 
  lessons, 
  totalCompletedHours, 
  onEditLesson, 
  onLessonClick,
  onLessonUpdated 
}: ListViewProps) {
  const [sortedLessons, setSortedLessons] = useState(lessons);
  const [totalLessonHours, setTotalLessonHours] = useState(0);
  const [includeNotes, setIncludeNotes] = useState(false);

  // Update sorted lessons when lessons prop changes
  useEffect(() => {
    const sorted = [...lessons].sort((a, b) => {
      const dateA = a.date.toDate();
      const dateB = b.date.toDate();
      return dateA.getTime() - dateB.getTime();
    });
    setSortedLessons(sorted);
  }, [lessons]);

  // Calculate total lesson hours for completed lessons
  useEffect(() => {
    const completedLessons = lessons.filter(lesson => lesson.completed);
    const total = calculateRealHours(completedLessons);
    setTotalLessonHours(total);
  }, [lessons]);

  const handleLessonClick = (lesson: any) => {
    onLessonClick(lesson);
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (window.confirm('Sei sicuro di voler eliminare questa lezione?')) {
      try {
        await deleteDoc(doc(db, 'lessons', lessonId));
        toast.success('Lezione eliminata con successo');
        onLessonUpdated();
      } catch (error) {
        console.error('Error deleting lesson:', error);
        toast.error('Errore durante l\'eliminazione della lezione');
      }
    }
  };

  const handleToggleCompletion = async (lessonId: string, completed: boolean) => {
    try {
      await updateDoc(doc(db, 'lessons', lessonId), { completed });
      onLessonUpdated();
    } catch (error) {
      console.error('Error updating lesson completion:', error);
      toast.error('Errore durante l\'aggiornamento dello stato della lezione');
    }
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('lessons-table');
    if (!element) return;

    const opt = {
      margin: 1,
      filename: 'riepilogo-lezioni.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
    };

    // Create a temporary container for PDF content
    const container = document.createElement('div');
    container.innerHTML = `
      <div style="padding: 20px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
          <img src="http://weblabfactory.it/logoregistroscuola.png" style="height: 60px;" />
          <div>
            <h2 style="margin: 0;">Riepilogo Lezioni</h2>
            <p>Ore totali svolte: ${totalCompletedHours.toFixed(2)}</p>
            <p>Ore lezione svolte: ${totalLessonHours.toFixed(2)}</p>
          </div>
        </div>
        ${element.outerHTML}
        ${includeNotes ? `
          <div style="margin-top: 20px;">
            <h3>Note Giornaliere</h3>
            ${sortedLessons.map(lesson => lesson.notes ? `
              <div style="margin-bottom: 10px;">
                <strong>${format(lesson.date.toDate(), 'dd/MM/yyyy')}</strong>: ${lesson.notes}
              </div>
            ` : '').join('')}
          </div>
        ` : ''}
        <div style="margin-top: 40px;">
          <p>Firma del Formatore/Operatore</p>
          <img src="http://weblabfactory.it/lamiafirmapers24.png" style="height: 60px;" />
        </div>
      </div>
    `;

    try {
      await html2pdf().set(opt).from(container).save();
      toast.success('PDF generato con successo');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Errore durante la generazione del PDF');
    }
  };

  return (
    <div className="bg-white shadow-sm rounded-lg">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={includeNotes}
              onChange={(e) => setIncludeNotes(e.target.checked)}
              className="sr-only peer"
            />
            <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            <span className="ms-3 text-sm font-medium text-gray-700">
              Includi Note nel PDF
            </span>
          </label>
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <FileText className="h-4 w-4 mr-2" />
            Esporta PDF
          </button>
        </div>
      </div>

      <table className="min-w-full divide-y divide-gray-200" id="lessons-table">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orario</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scuola</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classe</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ore</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Svolta</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Presenze</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Azioni</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedLessons.map((lesson) => {
            const hours = Math.ceil(calculateLessonHours(lesson.startTime, lesson.endTime));
            return (
              <tr key={lesson.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  {format(lesson.date.toDate(), 'dd/MM/yyyy')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {lesson.startTime} - {lesson.endTime}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span 
                    className="cursor-pointer hover:text-blue-600"
                    onClick={() => handleLessonClick(lesson)}
                  >
                    {lesson.school}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {lesson.class}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{hours}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="relative inline-block w-10 mr-2 align-middle select-none">
                    <input
                      type="checkbox"
                      checked={lesson.completed}
                      onChange={(e) => handleToggleCompletion(lesson.id, e.target.checked)}
                      className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer z-10"
                    />
                    <label className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handleLessonClick(lesson)}
                    className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium ${
                      (() => {
                        const lessonDate = lesson.date.toDate();
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        if (lessonDate > today) {
                          return 'bg-blue-100 text-blue-800';
                        }
                        
                        return lesson.attendanceVerified
                          ? 'bg-green-100 text-green-800'
                          : 'bg-orange-100 text-orange-800';
                      })()
                    }`}
                  >
                    Registra
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => onEditLesson(lesson)}
                    className="text-blue-600 hover:text-blue-900 mr-2 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full p-1"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteLesson(lesson.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-6 py-4 border-t border-gray-200">
        <p className="text-sm font-medium text-gray-700">
          Ore totali svolte: {totalCompletedHours.toFixed(2)}
          <br/>
          Ore lezione svolte: {totalLessonHours.toFixed(2)}
        </p>
      </div>

      <style jsx>{`
        .toggle-checkbox:checked {
          right: 0;
          border-color: rgb(104, 211, 145);
        }
        .toggle-checkbox:checked + .toggle-label {
          background-color: rgb(104, 211, 145);
        }
        .toggle-checkbox {
          right: 0;
          transition: all 0.3s;
        }
        .toggle-label {
          transition: all 0.3s;
        }
      `}</style>
    </div>
  );
}