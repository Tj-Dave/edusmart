import StudentWorkspace from '../modules/student/StudentWorkspace';
import type { StudentWorkspaceProps } from '../modules/student/types';

export default function ChatPage(props: StudentWorkspaceProps = {}) {
  return <StudentWorkspace {...props} />;
}
