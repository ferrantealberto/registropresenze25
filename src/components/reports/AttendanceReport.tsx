import { forwardRef } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface Student {
  id: string;
  name: string;
  class: string;
  school: string;
}

interface AttendanceReportProps {
  students: Student[];
  attendanceMap: Record<string, boolean>;
  notesMap: Record<string, string>;
  school: string;
  className: string;
  date: string;
  activity: {
    description: string;
    startTime: string;
    endTime: string;
    hours: number;
  } | null;
}

const AttendanceReport = forwardRef<HTMLDivElement, AttendanceReportProps>(
  ({ students, attendanceMap, notesMap, school, className, date, activity }, ref) => {
    return (
      <div ref={ref} className="bg-white" style={{ width: '297mm', height: '210mm', padding: '10mm', margin: 0 }}>
        {/* Header */}
        <div className="border-b border-gray-300 pb-0.5">
          <div className="flex items-start justify-between">
            <div className="flex items-center">
              <img 
                src="http://weblabfactory.it/logoregistroscuola.png" 
                alt="Logo" 
                style={{ width: '80px', height: 'auto' }}
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-[10px] font-semibold">
                <span>REGISTRO GIORNALIERO - data: {format(new Date(date), 'dd/MM/yyyy', { locale: it })}</span>
                <span>DALLE ORE: {activity?.startTime}</span>
                <span>ALLE ORE: {activity?.endTime}</span>
                <span>CLASSE: {className}</span>
              </div>
            </div>
          </div>

          {/* Project Title */}
          <div className="mt-1 border-t border-gray-200 pt-1">
            <div className="text-[9px]">Titolo prog.: <strong>S.E.M.E. 4.0 - Strategie Educative per Menti in Evoluzione</strong></div>
            <div className="text-[9px]">Co. Prog.: 2022-STE-01208 - codice attività: 56144-338961</div>
            <div className="text-[9px]">Attività: Laboratori di apprendimento collaborativo curriculari Agricoltura 4.0</div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex" style={{ height: 'calc(100% - 60px)' }}>
          {/* Left Side - Student List */}
          <div className="flex-grow border-r border-gray-300">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="w-8 py-1 px-2 text-center border-r border-gray-300 text-[10px]">#</th>
                  <th className="py-1 px-2 text-left border-r border-gray-300 text-[10px]">Studente</th>
                  <th className="py-1 px-2 text-left text-[10px]">Presenza</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => (
                  <tr key={student.id} className="border-b border-gray-300">
                    <td className="py-0.5 px-2 text-center border-r border-gray-300 text-[10px]">{index + 1}</td>
                    <td className="py-0.5 px-2 border-r border-gray-300 text-[10px]">{student.name}</td>
                    <td className="py-0.5 px-2 text-[10px]">
                      <span className={`inline-block px-1 rounded ${
                        attendanceMap[student.id] ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>{attendanceMap[student.id] ? 'Presente' : 'Assente'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Right Side - Activity and Signature */}
          <div style={{ width: '33%' }}>
            <div className="h-full flex flex-col">
              <div className="p-2 border-b border-gray-300" style={{ minHeight: '120px', maxHeight: '75%' }}>
                <div className="font-bold text-[10px] mb-1">Attività Svolta</div>
                <div className="text-[10px]">{activity?.description}</div>
              </div>
              <div className="p-2 mt-4">
                <div className="font-bold text-[10px] mb-1">FIRMA EDUCATORE/OPERATORE</div>
                <img 
                  src="/signature.png" 
                  alt="Firma" 
                  style={{ width: '150px', height: '50px', objectFit: 'contain' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

AttendanceReport.displayName = 'AttendanceReport';

export default AttendanceReport;