#ifndef READLINE_H
#define READLINE_H

#include <stdio.h>

/**
 * Reads an entire line from the input.
 *
 * \note The caller is required to call \c free() on the returned pointer
 *       at some point before exiting the program.
 *
 * \param   file            input file
 * \return  pointer to the newly allocated memory containing the lin
 *          or \c NULL on failure
 */
char *readline(FILE *file);

#endif // READLINE_H
