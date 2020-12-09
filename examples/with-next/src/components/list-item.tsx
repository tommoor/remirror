import Link from 'next/link';
import { FunctionComponent } from 'react';

import { User } from '../interfaces';

interface Props {
  data: User;
}

const ListItem: FunctionComponent<Props> = ({ data }) => (
  <Link href={`/detail?id=${data.id}`}>
    <a>
      {data.id}: {data.name}
    </a>
  </Link>
);

export default ListItem;
