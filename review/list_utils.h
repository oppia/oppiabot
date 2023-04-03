#ifndef LIST_UTILS_H
#define LIST_UTILS_H

/**
 * \file   list_utils.h
 * \author ...
 */

#include <stdbool.h>

#include "list.h"

//-----------------------------------------------------------------------------
//  Types
//-----------------------------------------------------------------------------

/**
 * \brief Predicate.
 */
typedef bool (*predicate)(const void *);

/**
 * \brief Comparator.
 *
 * Let a1 &lt; a2 denote that argument 1 should be before argument 2 in the
 * ordering implemented by this function; then the comparator returns number
 * <ul>
 *     <li> &lt; 0 if a1 &lt; a2</li>
 *     <li> &gt; 0 if a1 &gt; a2</li>
 *     <li> 0 otherwise </li>
 * </ul>
 */
typedef int (*comparator)(const void *, const void *);

/**
 * \brief Action.
 */
typedef void (*action)(void *);

//-----------------------------------------------------------------------------
//  Enumeration
//-----------------------------------------------------------------------------

/**
 * \brief Calls function \p f on each element from head to tail.
 *
 * \param list  the list
 * \param f     the function to call
 */
void list_for_each(struct list *list, action f);

//-----------------------------------------------------------------------------
//  Sorting
//-----------------------------------------------------------------------------

/**
 * \brief Sorts all elements in the list using \p cmp comparator.
 *
 * \param list  the list
 * \param cmp   the comparator
 */
void list_sort(struct list *list, comparator cmp);

#endif // LIST_UTILS_H
