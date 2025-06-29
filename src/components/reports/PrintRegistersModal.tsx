import { useState, useRef, useEffect } from 'react';
import Modal from 'react-modal';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { FileText, Printer, X, Save, Edit2, Check } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import html2pdf from 'html2pdf.js';
import { collection, query, where, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';

interface PrintRegistersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const modalStyles = {
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    zIndex: 1000
  },
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    maxWidth: '90%',
    width: '1200px',
    maxHeight: '90vh',
    padding: 0,
    border: 'none',
    borderRadius: '0.5rem',
    background: '#fff'
  }
};

// Set modal app element once
if (typeof window !== 'undefined') {
  Modal.setAppElement('#root');
}

export default function PrintRegistersModal({ isOpen, onClose }: PrintRegistersModalProps) {
  const [loading, setLoading] = useState(false);
  const [registers, setRegisters] = useState<any[]>([]);
  const [editingRegister, setEditingRegister] = useState<string | null>(null);
  const [editedActivity, setEditedActivity] = useState('');
  const [editedStartTime, setEditedStartTime] = useState('');
  const [editedEndTime, setEditedEndTime] = useState('');
  const [printedRegisters, setPrintedRegisters] = useState<Record<string, boolean>>({});
  const reportRef = useRef<HTMLDivElement>(null);

  const fetchRegisters = async () => {
    setLoading(true);
    try {
      const lessonsQuery = query(collection(db, 'lessons'), where('attendanceVerified', '==', true));
      const lessonsSnapshot = await getDocs(lessonsQuery);
      const lessons = lessonsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // For each lesson, get students and attendance records
      const registersWithData = await Promise.all(lessons.map(async (lesson) => {
        // Get students for this class
        const studentsQuery = query(
          collection(db, 'students'),
          where('school', '==', lesson.school),
          where('class', '==', lesson.class)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        const students = studentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          present: true // Default to present
        }));

        // Get attendance records
        const attendanceQuery = query(
          collection(db, 'attendance'),
          where('date', '==', lesson.date)
        );
        const attendanceSnapshot = await getDocs(attendanceQuery);
        
        // Update presence status for students
        attendanceSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.studentId) {
            const student = students.find(s => s.id === data.studentId);
            if (student) {
              student.present = data.present ?? true;
            }
          }
        });

        // Get activity details
        const activityQuery = query(
          collection(db, 'activities'),
          where('date', '==', lesson.date),
          where('school', '==', lesson.school),
          where('class', '==', lesson.class)
        );
        const activitySnapshot = await getDocs(activityQuery);
        const activity = activitySnapshot.docs[0] ? { id: activitySnapshot.docs[0].id, ...activitySnapshot.docs[0].data() } : null;

        return {
          ...lesson,
          students,
          activity
        };
      }));
      
      registersWithData.sort((a, b) => b.date.toDate() - a.date.toDate());

      setRegisters(registersWithData);
    } catch (error) {
      console.error('Error fetching registers:', error);
      toast.error('Errore nel recupero dei registri');
    } finally {
      setLoading(false);
    }
  };

  const handleEditStart = (register: any) => {
    setEditingRegister(register.id);
    setEditedStartTime(register.startTime);
    setEditedEndTime(register.endTime);
    setEditedActivity(register.activity?.description || '');
  };

  const handleSaveChanges = async (registerId: string) => {
    try {
      await updateDoc(doc(db, 'lessons', registerId), {
        startTime: editedStartTime,
        endTime: editedEndTime,
        lastModified: new Date()
      });

      const register = registers.find(r => r.id === registerId);
      if (register?.activity?.id) {
        await updateDoc(doc(db, 'activities', register.activity.id), {
          description: editedActivity,
          startTime: editedStartTime,
          endTime: editedEndTime,
          lastModified: new Date()
        });
      } else if (editedActivity) {
        // Create new activity if none exists
        await addDoc(collection(db, 'activities'), {
          description: editedActivity,
          startTime: editedStartTime,
          endTime: editedEndTime,
          date: register.date,
          school: register.school,
          class: register.class,
          created: new Date()
        });
      }

      toast.success('Modifiche salvate con successo');
      setEditingRegister(null);
      fetchRegisters();
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Errore durante il salvataggio delle modifiche');
    }
  };

  const handleCancelEdit = () => {
    setEditingRegister(null);
    setEditedStartTime('');
    setEditedEndTime('');
    setEditedActivity('');
  };

  const handlePrint = useReactToPrint({
    content: () => reportRef.current,
    pageStyle: `
      @page {
        size: landscape;
        margin: 10mm;
      }
    `,
    onBeforeGetContent: () => {
      document.body.classList.add('printing');
    },
    onAfterPrint: () => {
      document.body.classList.remove('printing');
    }
  });

  const handlePrintSingle = async (register: any) => {
    const element = document.getElementById(`register-${register.id}`);
    if (!element) return;

    // Add print class to body
    document.body.classList.add('printing');

    const opt = {
      margin: 10,
      filename: `registro-${register.school}-${register.class}-${format(register.date.toDate(), 'dd-MM-yyyy')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        windowWidth: 1200,
        windowHeight: 850
      },
      jsPDF: { 
        unit: 'mm',
        format: 'a4',
        orientation: 'landscape',
        compress: true
      }
    };

    try {
      await html2pdf().set(opt).from(element).save();
      toast.success('PDF generato con successo');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Errore nella generazione del PDF');
    } finally {
      document.body.classList.remove('printing');
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRegisters();
    }
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      style={modalStyles}
      contentLabel="Stampa Registri"
    >
      <div className="flex flex-col h-full">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <Printer className="h-6 w-6 mr-2" />
              Registri con Presenze Verificate
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="h-6 w-6 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : registers.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              Nessun registro con presenze verificate trovato
            </div>
          ) : (
            <div ref={reportRef}>
              <div className="space-y-8">
                {registers.map((register) => (
                  <div
                    key={register.id}
                    id={`register-${register.id}`}
                    className="bg-white p-6 mb-32 page-break-after-always print:mb-0 print:p-2 relative"
                    style={{ 
                      width: '100%',
                      height: '100%',
                      marginBottom: '4rem',
                      pageBreakAfter: 'always',
                      pageBreakInside: 'avoid'
                    }}
                  >
                    <div className="border-b border-gray-300 p-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center">
                          <img 
                            src="/logo.png" 
                            alt="Logo" 
                            className="w-24 h-auto print:w-20"
                          />
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <span>REGISTRO GIORNALIERO - data: {format(register.date.toDate(), 'dd/MM/yyyy', { locale: it })}</span>
                            {editingRegister === register.id ? (
                              <>
                                <div>
                                  <span>DALLE ORE: </span>
                                  <input
                                    type="time"
                                    value={editedStartTime}
                                    onChange={(e) => setEditedStartTime(e.target.value)}
                                    className="border rounded px-2 py-1"
                                  />
                                </div>
                                <div>
                                  <span>ALLE ORE: </span>
                                  <input
                                    type="time"
                                    value={editedEndTime}
                                    onChange={(e) => setEditedEndTime(e.target.value)}
                                    className="border rounded px-2 py-1"
                                  />
                                </div>
                              </>
                            ) : (
                              <>
                                <span>DALLE ORE: {register.startTime}</span>
                                <span>ALLE ORE: {register.endTime}</span>
                              </>
                            )}
                            <span>CLASSE: {register.class}</span>
                            {!editingRegister && (
                              <button
                                onClick={() => handleEditStart(register)}
                                className="ml-2 text-blue-600 hover:text-blue-800"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 border-t border-gray-200 pt-2">
                        <div className="text-[11px]">Titolo prog.: <strong>S.E.M.E. 4.0 - Strategie Educative per Menti in Evoluzione</strong></div>
                        <div className="text-[11px]">Co. Prog.: 2022-STE-01208 - codice attività: 56144-338961</div>
                        <div className="text-[11px]">Attività: Laboratori di apprendimento collaborativo curriculari Agricoltura 4.0</div>
                      </div>
                    </div>
                    <div className="flex flex-1" style={{ height: 'calc(100% - 180px)' }}>
                      <div className="flex-grow border-r border-gray-300">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-300">
                              <th className="w-8 p-1 text-center border-r border-gray-300 text-xs">#</th>
                              <th className="p-1 text-left border-r border-gray-300 text-xs">Studente</th>
                              <th className="p-1 text-left text-xs">Presenza</th>
                            </tr>
                          </thead>
                          <tbody>
                            {register.students?.map((student: any, index: number) => (
                              <tr key={student.id} className="border-b border-gray-300">
                                <td className="p-1 text-center border-r border-gray-300 text-xs">{index + 1}</td>
                                <td className="p-1 border-r border-gray-300 text-xs">{student.name}</td>
                                <td className="p-1 text-xs text-left">
                                  <span className={`inline-block px-2 py-1 rounded ${
                                    student.present ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}>{student.present ? 'Presente' : 'Assente'}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="w-1/3">
                        <div className="h-full flex flex-col">
                          <div className="p-3 border-b border-gray-300">
                            <div className="font-bold text-sm mb-2">Attività Svolta</div>
                            {editingRegister === register.id ? (
                              <textarea
                                value={editedActivity || register.activity?.description || ''}
                                onChange={(e) => setEditedActivity(e.target.value)}
                                className="w-full h-32 p-2 border rounded text-sm"
                                placeholder="Descrivi l'attività svolta..."
                              />
                            ) : (
                              <div className="text-sm min-h-[150px]">{register.activity?.description}</div>
                            )}
                          </div>
                          <div className="mt-auto p-3 border-t border-gray-300">
                            <div className="font-bold text-sm mb-2">FIRMA EDUCATORE/OPERATORE</div>
                            <img 
                              src="/signature.png" 
                              alt="Firma" 
                              className="w-32 h-auto"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end space-x-2">
                      {editingRegister === register.id ? (
                        <>
                          <button
                            onClick={() => handleSaveChanges(register.id)}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 print:hidden"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Salva Modifiche
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 print:hidden"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Annulla
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center mr-4">
                            <label className="inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={printedRegisters[register.id] || false}
                                onChange={(e) => setPrintedRegisters(prev => ({
                                  ...prev,
                                  [register.id]: e.target.checked
                                }))}
                                className="sr-only peer"
                              />
                              <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                              <span className="ms-3 text-sm font-medium text-gray-700">
                                {printedRegisters[register.id] ? 'Stampato' : 'Non Stampato'}
                              </span>
                            </label>
                          </div>
                          <button
                            onClick={() => handlePrintSingle(register)}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 print:hidden z-10"
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Salva PDF
                          </button>
                          <button
                            onClick={handlePrint}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 print:hidden z-10"
                          >
                            <Printer className="h-4 w-4 mr-2" />
                            Stampa
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}