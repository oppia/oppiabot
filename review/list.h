#ifndef LIST_H
#define LIST_H

/**
 * \file   list.h
 * \author Roman Lacko <xlacko1@fi.muni.cz>
 */

#include <stdlib.h>
#include <stdbool.h>

//-----------------------------------------------------------------------------
//  Features
//-----------------------------------------------------------------------------

// Example implementation has the following macros enabled
#define LLIST_ENABLE_TWO_LINKS
#define LLIST_ENABLE_FAM
#define LLIST_ENABLE_ALL_ENDS

//-----------------------------------------------------------------------------
//  Types
//-----------------------------------------------------------------------------

/**
 * \brief Doubly linked list node.
 */
struct node
{
    struct node *next; /**< next node */
    struct node *prev; /**< previous node */

    char data[]; /**< flexible array member */
};

/**
 * \brief Doubly linked list.
 */
struct list
{
    struct node *head; /**< list's first node */
    struct node *tail; /**< list's last node  */
    size_t elem_size;  /**< size of stored elements */
};

//-----------------------------------------------------------------------------
//  Consistency requirements
//-----------------------------------------------------------------------------

/*
 * Let «P» be a property that a list has if and only if it satisfies
 * the following requirements:
 *
 * A) ‹list->head› is ‹NULL› if and only if the ‹list->tail› is ‹NULL›,
 * B) if ‹list->head› is not ‹NULL›, then ‹head->prev› is ‹NULL›,
 * C) if ‹list->tail› is not ‹NULL›, then ‹tail->next› is ‹NULL›,
 *
 * Each of the following functions must satisfy this condition:
 *
 *     If the function's argument is a list with property «P», then
 *     the list also has the property «P» after the function ends.
 */

//-----------------------------------------------------------------------------
//  Note
//-----------------------------------------------------------------------------

/*
 * Unless stated otherwise, ‹NULL› value passed as a parameter to any of
 * the following functions causes undefined behaviour. This is not tested
 * by the included tests.
 *
 * Use ‹assert()› to check for these conditions.
 */

//-----------------------------------------------------------------------------
//  Functions
//-----------------------------------------------------------------------------

/**
 * \brief Initializes the list structure.
 *
 * The result of this operation is an empty list.
 *
 * \note The behaviour of this function is undefined if \p element_size is zero.
 *
 * \param element_size  size (in bytes) of stored elements
 */
void list_init(struct list *list, size_t element_size);

/**
 * \brief Releases all resources associated with the \p list.
 */
void list_destroy(struct list *list);

/**
 * \brief Returns the number of elements stored in the list.
 */
size_t list_size(const struct list *list);

/**
 * \brief Predicate that tells wheter the \a list is empty or not.
 *
 * \returns         \c true if the \a list is empty, \c false otherwise
 */
bool list_is_empty(const struct list *list);

/**
 * \brief Inserts a new element after the last element in the list.
 *
 * The element will contain a copy of the memory pointed to by the
 * \p data parameter.
 *
 * \param data      pointer to data to be stored
 * \returns \c true if the operation was successful, \c false otherwise
 */
bool list_push_back(struct list *list, const void *data);

/**
 * \brief Removes and returns the last element stored in the list.
 *
 * If \p data is not \c NULL, contents of the node data will be copied
 * to the memory pointed to by \p data pointer.
 *
 * \note    If \p data is set to \c NULL, the element is simply discarded.
 * \note    If the list is empty, the function must not change the memory
 *          pointed to by \p data.
 *
 * \returns \c true if the operation was successful, \c false otherwise
 */
bool list_pop_back(struct list *list, void *data);

/**
 * \brief Inserts a new element before the first element in the list.
 *
 * The element will contain a copy of the memory pointed to by the
 * \p data parameter.
 *
 * \param data      pointer to data to be stored
 * \return \c true if the operation was successful, \c false otherwise
 */
bool list_push_front(struct list *list, const void *data);

/**
 * \brief Removes and returns the first element stored in the list.
 *
 * If \p data is not \c NULL, contents of the node data will be copied
 * to the memory pointed to by \p data pointer.
 *
 * \note    If \p list is empty, the operation fails.
 * \note    If the list is empty, the function must not change the memory
 *          pointed to by \p data.
 *
 * \returns \c true if the operation was successful, \c false otherwise
 */
bool list_pop_front(struct list *list, void *data);

#endif // LIST_H
