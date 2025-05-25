import { useState } from 'react';
import { LogOut, School as SchoolIcon, Home, Trash2, Users, Download, Printer, FileSpreadsheet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { collection, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import PrintRegistersModal from '../reports/PrintRegistersModal';

import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export default function Header() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [showPrintRegisters, setShowPrintRegisters] = useState(false);

  const handleExportDatabase = async () => {
    try {
      const collections = ['students', 'activities', 'attendance'];
      const data: { [key: string]: any[] } = {};

      // Fetch and process each collection
      for (const collectionName of collections) {
        const q = query(collection(db, collectionName));
        const querySnapshot = await getDocs(q);
        data[collectionName] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate?.() ? format(doc.data().date.toDate(), 'dd/MM/yyyy') : '',
          timestamp: doc.data().timestamp?.toDate?.() ? format(doc.data().timestamp.toDate(), 'dd/MM/yyyy HH:mm:ss') : ''
        }));
      }

      // Create and configure workbook
      // Sort students by school and class
      data.students.sort((a, b) => {
        if (a.school === b.school) {
          return a.class.localeCompare(b.class);
        }
        return a.school.localeCompare(b.school);
      });

      const wb = XLSX.utils.book_new();
      
      // Configure sheet names and column widths
      const sheetNames = {
        students: 'Studenti',
        activities: 'Attività',
        attendance: 'Presenze'
      };

      // Process each collection
      for (const [collectionName, items] of Object.entries(data)) {
        const ws = XLSX.utils.json_to_sheet(items);
        XLSX.utils.book_append_sheet(wb, ws, sheetNames[collectionName as keyof typeof sheetNames]);
        
        // Auto-size columns
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        const cols = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
          let maxLen = 0;
          for (let R = range.s.r; R <= range.e.r; ++R) {
            const cell = ws[XLSX.utils.encode_cell({r: R, c: C})];
            if (cell?.v) maxLen = Math.max(maxLen, String(cell.v).length);
          }
          cols[C] = { wch: maxLen + 2 };
        }
        ws['!cols'] = cols;
      }

      XLSX.writeFile(wb, 'database-export.xlsx');
      toast.success('Database esportato con successo');
    } catch (error) {
      console.error('Error exporting database:', error);
      toast.error('Errore durante l\'esportazione del database');
    }
  };

  const handleHomeClick = () => {
    navigate('/');
    window.location.reload();
  };

  const handleDeleteAllData = async () => {
    if (window.confirm('Sei sicuro di voler eliminare tutti i dati delle classi? Questa azione non può essere annullata.')) {
      try {
        // Delete students
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        for (const docRef of studentsSnapshot.docs) {
          await deleteDoc(doc(db, 'students', docRef.id));
        }

        // Delete attendance records
        const attendanceSnapshot = await getDocs(collection(db, 'attendance'));
        for (const docRef of attendanceSnapshot.docs) {
          await deleteDoc(doc(db, 'attendance', docRef.id));
        }

        // Delete activities
        const activitiesSnapshot = await getDocs(collection(db, 'activities'));
        for (const docRef of activitiesSnapshot.docs) {
          await deleteDoc(doc(db, 'activities', docRef.id));
        }

        toast.success('Tutti i dati sono stati eliminati con successo');
        window.location.reload();
      } catch (error) {
        console.error('Error deleting data:', error);
        toast.error('Errore durante l\'eliminazione dei dati');
      }
    }
  };

  const handleExportOrganizedData = async () => {
    try {
      // Fetch all collections
      const collections = ['students', 'activities', 'attendance', 'lessons'];
      const data: { [key: string]: any[] } = {};

      for (const collectionName of collections) {
        const querySnapshot = await getDocs(collection(db, collectionName));
        data[collectionName] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      }

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Students sheet
      const studentsData = data.students
        .sort((a, b) => {
          if (a.school === b.school) {
            if (a.class === b.class) {
              return a.name.localeCompare(b.name);
            }
            return a.class.localeCompare(b.class);
          }
          return a.school.localeCompare(b.school);
        })
        .map(student => ({
          Scuola: student.school,
          Classe: student.class,
          'Nome Studente': student.name
        }));

      // Activities sheet
      const activitiesData = data.activities
        .sort((a, b) => a.date.toDate() - b.date.toDate())
        .map(activity => ({
          Data: format(activity.date.toDate(), 'dd/MM/yyyy', { locale: it }),
          Scuola: activity.school,
          Classe: activity.class,
          'Ora Inizio': activity.startTime,
          'Ora Fine': activity.endTime,
          'Ore Totali': activity.hours,
          Descrizione: activity.description
        }));

      // Attendance sheet
      const attendanceData = data.attendance
        .sort((a, b) => a.date.toDate() - b.date.toDate())
        .map(record => ({
          Data: format(record.date.toDate(), 'dd/MM/yyyy', { locale: it }),
          'ID Studente': record.studentId,
          Presente: record.present ? 'Sì' : 'No',
          Note: record.notes || '',
          Verificato: record.attendanceVerified ? 'Sì' : 'No',
          'Verificato da': record.verifiedBy || '',
          'Data Verifica': record.verifiedAt ? format(record.verifiedAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: it }) : ''
        }));

      // Lessons sheet
      const lessonsData = data.lessons
        .sort((a, b) => a.date.toDate() - b.date.toDate())
        .map(lesson => ({
          Data: format(lesson.date.toDate(), 'dd/MM/yyyy', { locale: it }),
          Scuola: lesson.school,
          Classe: lesson.class,
          'Ora Inizio': lesson.startTime,
          'Ora Fine': lesson.endTime,
          'Ore': lesson.hours,
          'Presenze Verificate': lesson.attendanceVerified ? 'Sì' : 'No'
        }));

      // Add sheets to workbook
      const sheets = [
        { name: 'Studenti', data: studentsData },
        { name: 'Attività', data: activitiesData },
        { name: 'Presenze', data: attendanceData },
        { name: 'Lezioni', data: lessonsData }
      ];

      sheets.forEach(sheet => {
        const ws = XLSX.utils.json_to_sheet(sheet.data);
        XLSX.utils.book_append_sheet(wb, ws, sheet.name);

        // Auto-size columns
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        const cols = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
          let maxLen = 0;
          for (let R = range.s.r; R <= range.e.r; ++R) {
            const cell = ws[XLSX.utils.encode_cell({r: R, c: C})];
            if (cell?.v) maxLen = Math.max(maxLen, String(cell.v).length);
          }
          cols[C] = { wch: maxLen + 2 };
        }
        ws['!cols'] = cols;
      });

      // Save file
      XLSX.writeFile(wb, `registro-presenze-${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
      toast.success('Database esportato con successo');
    } catch (error) {
      console.error('Error exporting database:', error);
      toast.error('Errore durante l\'esportazione del database');
    }
  };

  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <SchoolIcon className="h-8 w-8 text-blue-600" />
            <span className="ml-2 text-xl font-semibold text-gray-900">
              Sistema Presenze
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleHomeClick}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Home className="h-4 w-4 mr-2" />
              Vai alla Home
            </button>
            <button
              onClick={() => navigate('/import')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Importa Classi
            </button>
            <button
              onClick={() => navigate('/students')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Users className="h-4 w-4 mr-2" />
              Gestione Studenti
            </button>
            <button
              onClick={() => setShowPrintRegisters(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Printer className="h-4 w-4 mr-2" />
              Registri Verificati
            </button>
            <button
              onClick={handleExportDatabase}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Download className="h-4 w-4 mr-2" />
              Esporta Database
            </button>
            <button
              onClick={handleExportOrganizedData}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Esporta Excel Organizzato
            </button>
            <button
              onClick={handleDeleteAllData}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Elimina dati classi
            </button>
            <button
              onClick={logout}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Esci
            </button>
          </div>
        </div>
      </div>
      <PrintRegistersModal
        isOpen={showPrintRegisters}
        onClose={() => setShowPrintRegisters(false)}
      />
    </nav>
  );
}