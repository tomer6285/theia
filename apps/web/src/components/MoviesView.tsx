import React from 'react';
import { CatalogView } from './CatalogView';
export const MoviesView = (props: Omit<React.ComponentProps<typeof CatalogView>, 'type'>) =>
  <CatalogView {...props} type="movie" />;
